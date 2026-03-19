'use client'

import { useState, useRef, useEffect } from 'react'
import { useStore, type Agent } from '@/lib/store'
import { formatTime } from '@/lib/utils'

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

const parseScore = (text: string): number | null => {
  const m =
    /(?:score|rating)[:\s]+(\d{1,3})\s*\/\s*100/i.exec(text) ||
    /\b(\d{1,3})\s*\/\s*100\b/.exec(text)
  if (!m) return null
  const n = parseInt(m[1] ?? '0')
  return n >= 0 && n <= 100 ? n : null
}

export function StreamingTerminal({ agent }: { agent: Agent }) {
  const { updateAgent, appendMessage } = useStore()
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

  return (
    <div className="border-t border-white/5">
      {/* Session stats bar */}
      {(agent.sessionStartedAt != null || agent.sessionCost > 0) && (
        <div className="flex items-center gap-3 px-3 py-1.5 border-b border-white/5 text-xs font-mono">
          {agent.sessionStartedAt != null && (
            <span className="text-white/30">started {formatTime(agent.sessionStartedAt)}</span>
          )}
          {agent.sessionCost > 0 && (
            <span className={agent.budgetCap != null && agent.sessionCost >= agent.budgetCap ? 'text-red-400' : agent.budgetCap != null && agent.sessionCost >= agent.budgetCap * 0.8 ? 'text-amber-400' : 'text-amber/60'}>
              ${agent.sessionCost.toFixed(4)}
            </span>
          )}
          {agent.sessionTurns > 0 && (
            <span className="text-white/30">{agent.sessionTurns} run{agent.sessionTurns !== 1 ? 's' : ''}</span>
          )}
          {agent.sessionTokens != null && agent.sessionTokens > 0 && (
            <span className="text-white/25">{(agent.sessionTokens / 1000).toFixed(1)}k tok</span>
          )}
          {agent.iterationRound > 0 && (
            <span className="text-purple-400/60">round {agent.iterationRound}</span>
          )}
          {agent.iterationScore != null && agent.iterationRound > 0 && (
            <span className="text-white/40">auto {agent.iterationScore}/100</span>
          )}
          {!streaming && (
            <button
              onClick={() => updateAgent(agent.id, { sessionCost: 0, sessionTurns: 0, sessionTokens: null, sessionStartedAt: null, sessionId: null })}
              className="ml-auto text-white/15 hover:text-white/50 transition-all"
              title="Reset session stats and cost counter">
              ↺ reset
            </button>
          )}
        </div>
      )}

      {/* Message history + live stream */}
      <div ref={scrollRef} className="h-64 overflow-y-auto p-3 space-y-1.5 bg-black/30 font-mono text-xs">
        {agent.messages.length === 0 && liveOutput.length === 0 && (
          <div className="opacity-15 text-center py-12">Send a prompt to start this agent in {agent.repo}...</div>
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
            {agent.iterationRound > 0 ? `Iterating (round ${agent.iterationRound})...` : 'Agent is working...'}
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
          placeholder={agent.sessionId ? 'Follow-up (session active)...' : 'Initial prompt...'}
          disabled={streaming}
          className="flex-1 text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20 disabled:opacity-30"
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
            📝→ Roadmap
          </button>
        )}
        {streaming ? (
          <button onClick={stopAgent}
            className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">
            Stop
          </button>
        ) : (
          <button onClick={() => void sendPrompt()} disabled={!input.trim()}
            className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-20 transition-all"
            style={{ backgroundColor: 'rgba(212,168,67,0.2)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}>
            Send
          </button>
        )}
      </div>
    </div>
  )
}
