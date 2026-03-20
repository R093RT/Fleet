'use client'

import { useState, useRef, useEffect } from 'react'
import { useStore, type Agent } from '@/lib/store'
import { parseScore } from '@/lib/utils'
import { SessionStatsBar } from './SessionStatsBar'
import { PT } from './PirateTerm'
import { usePirateText } from '@/hooks/usePirateMode'

interface StreamMessage {
  type: 'assistant' | 'result' | 'system' | 'tool_result' | 'text' | 'stderr' | 'done' | 'error'
  agentId: string
  text?: string
  content?: string
  toolUses?: { tool: string; input: unknown }[]
  sessionId?: string | null
  subtype?: string
  cost?: number | null
  inputTokens?: number | null
  outputTokens?: number | null
  duration?: number | null
  exitCode?: number
}


export function StreamingTerminal({ agent }: { agent: Agent }) {
  const { updateAgent, appendMessage } = useStore()
  const t = usePirateText()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [liveOutput, setLiveOutput] = useState<StreamMessage[]>([])
  const [lastAssistantText, setLastAssistantText] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const iterRef = useRef<{ mode: 'rating' | 'improving'; round: number } | null>(null)
  const pendingPromptRef = useRef<string | null>(null)
  const iterCancelRef = useRef(false)

  const scrollToBottom = () => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)

  const sendPrompt = async (explicitPrompt?: string) => {
    const prompt = explicitPrompt ?? input.trim()
    if (!prompt || streaming) return
    if (!explicitPrompt) setInput('')
    iterCancelRef.current = false
    setStreaming(true)
    setLiveOutput([])

    appendMessage(agent.id, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    })

    updateAgent(agent.id, {
      status: 'running',
      lastUpdate: Date.now(),
      isStreaming: true,
      // Record when the session started (only on first ever send)
      ...(agent.sessionStartedAt == null ? { sessionStartedAt: Date.now() } : {}),
    })

    // Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Inject roadmap into first prompt for quartermaster agents or agents with injectRoadmap enabled
    let effectivePrompt = prompt
    if (!agent.sessionId && (agent.agentType === 'quartermaster' || agent.injectRoadmap)) {
      try {
        const r = await fetch('/api/roadmap')
        const rd = await r.json()
        if (rd.exists && rd.content) {
          effectivePrompt = `[ROADMAP]\n${rd.content as string}\n\n[TASK]\n${prompt}`
          appendMessage(agent.id, {
            id: `msg-${Date.now()}-ri`,
            role: 'system',
            content: `📖 Roadmap injected (${(rd.content.length / 1000).toFixed(1)}k chars)`,
            timestamp: Date.now(),
          })
        }
      } catch {}
    }

    // Resolve effective working path — create a worktree on first spawn
    let effectivePath = agent.worktreePath || agent.path
    if (!agent.worktreePath) {
      try {
        const wtRes = await fetch('/api/worktree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent.id, repoPath: agent.path }),
        })
        const wt = await wtRes.json()
        if (wt.worktreePath) {
          updateAgent(agent.id, { worktreePath: wt.worktreePath, worktreeBranch: wt.branchName })
          effectivePath = wt.worktreePath
        }
      } catch {}
      // If worktree creation fails (not a git repo, etc.) we fall back to agent.path
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          repoPath: effectivePath,
          prompt: effectivePrompt,
          sessionId: agent.sessionId,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || `HTTP ${res.status}`)
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (reader) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6)
          try {
            const msg: StreamMessage = JSON.parse(data)
            setLiveOutput(prev => [...prev, msg])
            scrollToBottom()

            // Update session ID
            if (msg.sessionId) {
              updateAgent(agent.id, { sessionId: msg.sessionId })
            }

            // Handle completion — accumulate session stats
            if (msg.type === 'result') {
              const finalText = msg.text || ''
              setLastAssistantText(finalText)
              appendMessage(agent.id, {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: finalText,
                timestamp: Date.now(),
              })

              const addedTokens = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)
              const newCost = (agent.sessionCost || 0) + (msg.cost || 0)
              updateAgent(agent.id, {
                status: 'done',
                lastUpdate: Date.now(),
                isStreaming: false,
                sessionCost: newCost,
                sessionTurns: (agent.sessionTurns || 0) + 1,
                sessionTokens: addedTokens > 0
                  ? (agent.sessionTokens || 0) + addedTokens
                  : agent.sessionTokens,
              })

              // Track daily spend
              if (msg.cost) {
                const today = new Date().toISOString().slice(0, 10)
                useStore.getState().addDailySpend(today, msg.cost)
              }

              // Budget cap soft warning
              if (agent.budgetCap != null && newCost >= agent.budgetCap) {
                appendMessage(agent.id, {
                  id: `msg-${Date.now()}-bc`,
                  role: 'system',
                  content: `⚠️ Budget cap $${agent.budgetCap.toFixed(2)} reached. Session cost: $${newCost.toFixed(4)}`,
                  timestamp: Date.now(),
                })
              }

              // Auto-complete voyage tasks for this agent when done
              const currentVoyage = useStore.getState().voyage
              if (currentVoyage) {
                const agentTasks = currentVoyage.tasks.filter(t => t.agentId === agent.id && !t.completed)
                for (const task of agentTasks) {
                  useStore.getState().completeVoyageTask(task.id)
                }
              }

              // Auto-iterate logic
              if (agent.autoIterate) {
                if (iterRef.current === null) {
                  // First task completion — kick off auto-rating
                  iterRef.current = { mode: 'rating', round: 1 }
                  updateAgent(agent.id, { iterationRound: 1 })
                  pendingPromptRef.current =
                    'Rate your work from 0–100 and list specific improvements. Format: Score: X/100'
                  appendMessage(agent.id, { id: `msg-${Date.now()}-ai`, role: 'system', content: '⟳ Auto-iterate: rating quality...', timestamp: Date.now() })
                } else if (iterRef.current.mode === 'rating') {
                  const score = parseScore(finalText)
                  if (score !== null) {
                    updateAgent(agent.id, { score, iterationScore: score })
                    if (score < agent.iterateThreshold && iterRef.current.round < agent.iterateMaxRounds) {
                      const nextRound = iterRef.current.round + 1
                      iterRef.current = { mode: 'improving', round: nextRound }
                      updateAgent(agent.id, { iterationRound: nextRound })
                      pendingPromptRef.current = `Your score was ${score}/100. Improve the specific areas you identified.`
                      appendMessage(agent.id, { id: `msg-${Date.now()}-ai`, role: 'system', content: `⟳ Auto-iterate: score ${score}/100 < ${agent.iterateThreshold}. Improving (round ${nextRound}/${agent.iterateMaxRounds})...`, timestamp: Date.now() })
                    } else {
                      iterRef.current = null
                      updateAgent(agent.id, { iterationRound: 0 })
                      appendMessage(agent.id, { id: `msg-${Date.now()}-ai`, role: 'system', content: `✓ Auto-iterate done. Final score: ${score}/100`, timestamp: Date.now() })
                      if ('Notification' in window && Notification.permission === 'granted') {
                        new Notification(`${agent.name} finished (${score}/100)`, {
                          body: finalText.slice(0, 100),
                          icon: '/favicon.ico',
                          tag: agent.id,
                        })
                      }
                    }
                  } else {
                    iterRef.current = null
                    updateAgent(agent.id, { iterationRound: 0 })
                  }
                } else if (iterRef.current.mode === 'improving') {
                  // Re-rate after the improvement pass
                  iterRef.current = { mode: 'rating', round: iterRef.current.round }
                  pendingPromptRef.current = 'Rate your updated work from 0–100. Format: Score: X/100'
                  appendMessage(agent.id, { id: `msg-${Date.now()}-ai`, role: 'system', content: '⟳ Auto-iterate: re-rating after improvements...', timestamp: Date.now() })
                }
              } else {
                // Normal completion — send desktop notification
                if ('Notification' in window && Notification.permission === 'granted') {
                  new Notification(`${agent.name} finished`, {
                    body: finalText.slice(0, 100) + (finalText.length > 100 ? '...' : ''),
                    icon: '/favicon.ico',
                    tag: agent.id,
                  })
                }
              }
            }

            if (msg.type === 'done') {
              updateAgent(agent.id, { isStreaming: false })
            }

            if (msg.type === 'error') {
              updateAgent(agent.id, { status: 'error', isStreaming: false, lastUpdate: Date.now() })
              appendMessage(agent.id, {
                id: `msg-${Date.now()}`,
                role: 'system',
                content: `Error: ${msg.content}`,
                timestamp: Date.now(),
              })
            }
          } catch {}
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error) || e.name !== 'AbortError') {
        appendMessage(agent.id, {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `Connection error: ${e instanceof Error ? e.message : String(e)}`,
          timestamp: Date.now(),
        })
        updateAgent(agent.id, { status: 'error', isStreaming: false })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
      // Auto-iterate: schedule next prompt
      if (pendingPromptRef.current) {
        const next = pendingPromptRef.current
        pendingPromptRef.current = null
        setTimeout(() => { if (!iterCancelRef.current) void sendPrompt(next) }, 300)
      }
    }
  }

  const stopAgent = () => {
    abortRef.current?.abort()
    iterRef.current = null
    pendingPromptRef.current = null
    iterCancelRef.current = true
    setStreaming(false)
    updateAgent(agent.id, { status: 'idle', isStreaming: false, iterationRound: 0 })
  }

  const handleResume = () => {
    setInput('')
    inputRef.current?.focus()
  }

  // Pick up prompts injected by the reactions engine
  useEffect(() => {
    if (agent.pendingTrigger && !streaming) {
      const prompt = agent.pendingTrigger
      updateAgent(agent.id, { pendingTrigger: null })
      void sendPrompt(prompt)
    }
  // sendPrompt is stable (defined in component body; deps don't change identity)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.pendingTrigger, streaming])

  // Auto-launch: pick up agents queued via voyagePendingLaunch (Set Sail)
  useEffect(() => {
    const state = useStore.getState()
    if (!state.voyagePendingLaunch.includes(agent.id)) return
    if (streaming || agent.sessionId) return

    // Remove this agent from the pending list
    state.setVoyagePendingLaunch(state.voyagePendingLaunch.filter(id => id !== agent.id))

    // Build the auto-launch prompt with treasure map + mission
    const voyage = state.voyage
    const missionTasks = voyage?.tasks.filter(t => t.agentId === agent.id).map(t => t.name) ?? []
    const prompt = [
      voyage?.treasureMap ? `[TREASURE MAP]\n${voyage.treasureMap}` : '',
      `\n[YOUR MISSION]\nYou are ${agent.name}, the ${agent.role} of this crew.`,
      missionTasks.length > 0 ? `Your assigned tasks:\n${missionTasks.map(t => `- ${t}`).join('\n')}` : '',
      agent.task ? `\nDescription: ${agent.task}` : '',
      '\nBegin working on your tasks. Start with the highest priority items.',
    ].filter(Boolean).join('\n')

    // Stagger launch slightly to avoid race conditions
    const delay = Math.random() * 2000
    setTimeout(() => void sendPrompt(prompt), delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="border-t border-white/5">
      <SessionStatsBar agent={agent} streaming={streaming} />

      {/* Message history + live stream */}
      <div ref={scrollRef} className="h-64 overflow-y-auto p-3 space-y-1.5 bg-black/30 font-mono text-xs">
        {agent.messages.length === 0 && liveOutput.length === 0 && (
          <div className="opacity-15 text-center py-12">{t(`Give orders to start this pirate in ${agent.repo}...`, `Enter a prompt to start this agent in ${agent.repo}...`)}</div>
        )}

        {/* Historical messages */}
        {agent.messages.map(m => (
          <div key={m.id} className={m.role === 'user' ? 'text-amber' : m.role === 'system' ? 'text-white/25 italic' : 'text-white/70'}>
            <span className="opacity-30 mr-2 tabular-nums">
              {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="opacity-40 mr-1">{m.role === 'user' ? '>' : m.role === 'system' ? '#' : '←'}</span>
            <span className="whitespace-pre-wrap break-all">{m.content.slice(0, 3000)}{m.content.length > 3000 ? '\n...(truncated)' : ''}</span>
          </div>
        ))}

        {/* Live streaming output */}
        {liveOutput.map((msg, i) => (
          <div key={i} className={
            msg.type === 'assistant' ? 'text-white/70' :
            msg.type === 'tool_result' ? 'text-cyan-400/60' :
            msg.type === 'stderr' ? 'text-red-400/60' :
            msg.type === 'result' ? 'text-green-400/80' :
            msg.type === 'system' ? 'text-white/25' :
            'text-white/40'
          }>
            {msg.type === 'assistant' && msg.text && (
              <span className="whitespace-pre-wrap break-all">{msg.text}</span>
            )}
            {msg.type === 'assistant' && msg.toolUses?.map((t, j) => (
              <div key={j} className="text-blue-400/50 ml-2">
                ↳ {t.tool}({typeof t.input === 'string' ? t.input.slice(0, 100) : JSON.stringify(t.input).slice(0, 100)})
              </div>
            ))}
            {msg.type === 'tool_result' && <span className="ml-2">↳ {msg.content?.slice(0, 200)}</span>}
            {msg.type === 'result' && (
              <div className="mt-1 pt-1 border-t border-white/5">
                ✓ Complete {msg.cost ? `($${msg.cost.toFixed(4)})` : ''} {msg.subtype || ''}
                {msg.duration ? ` · ${(msg.duration / 1000).toFixed(1)}s` : ''}
                {(msg.inputTokens || msg.outputTokens)
                  ? ` · ${((msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)).toLocaleString()} tokens`
                  : ''}
              </div>
            )}
            {msg.type === 'stderr' && <span className="ml-2">stderr: {msg.content}</span>}
            {msg.type === 'error' && <span className="text-red-400">✗ {msg.content}</span>}
          </div>
        ))}

        {streaming && (
          <div className="text-green-400/60 animate-pulse flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
            {agent.iterationRound > 0 ? t(`Keep Sailing (round ${agent.iterationRound})...`, `Auto-iterating (round ${agent.iterationRound})...`) : t('Pirate is sailing...', 'Agent is running...')}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-white/5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void sendPrompt()}
          placeholder={agent.sessionId ? t('Follow-up orders (session active)...', 'Follow-up prompt (session active)...') : t('Give yer orders, Captain...', 'Enter your prompt...')}
          disabled={streaming}
          className="flex-1 input-field disabled:opacity-30"
        />
        {!streaming && agent.sessionId && (
          <button onClick={handleResume}
            className="text-xs px-2 py-1.5 rounded bg-white/5 text-white/40 hover:text-white/70 border border-white/8 transition-all"
            title="Pre-fill a resume prompt">
            ↺ Resume
          </button>
        )}
        {!streaming && agent.agentType === 'quartermaster' && lastAssistantText && (
          <button
            onClick={() => {
              void fetch('/api/roadmap', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: lastAssistantText }),
              }).then(() => {
                appendMessage(agent.id, {
                  id: `msg-${Date.now()}-rw`,
                  role: 'system',
                  content: '📝 Saved to roadmap',
                  timestamp: Date.now(),
                })
                setLastAssistantText(null)
              })
            }}
            className="text-xs px-2 py-1.5 rounded bg-violet-500/15 text-violet-400/80 border border-violet-500/20 hover:bg-violet-500/25 transition-all"
            title="Save last response to the roadmap file">
            {t('📝→ Treasure Map', '📝→ Roadmap')}
          </button>
        )}
        {streaming ? (
          <button onClick={stopAgent}
            className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
            title="Stop Agent">
            <PT k="All Stop!" className="border-0" />
          </button>
        ) : (
          <button onClick={() => void sendPrompt()} disabled={!input.trim()}
            className="btn-primary" title="Send Prompt">
            <PT k="Fire!" className="border-0" />
          </button>
        )}
      </div>
    </div>
  )
}
