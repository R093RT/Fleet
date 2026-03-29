'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore, type Agent } from '@/lib/store'
import { detectKeywords, type KeywordMatch } from '@/lib/keywords'
import { checkBudgetGates, buildEffectivePrompt, createWorktreeIfNeeded, handleResultMessage, type IterState } from '@/lib/stream-helpers'
import { SessionStatsBar } from './SessionStatsBar'
import { PT } from './PirateTerm'
import { usePirateText } from '@/hooks/usePirateMode'
import { useToast } from '@/lib/toast-store'

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


export function StreamingTerminal({ agent, fillHeight, autoFocus }: { agent: Agent; fillHeight?: boolean; autoFocus?: boolean }) {
  const { updateAgent, appendMessage } = useStore()
  const t = usePirateText()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [liveOutput, setLiveOutput] = useState<StreamMessage[]>([])
  const [lastAssistantText, setLastAssistantText] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const iterRef = useRef<IterState | null>(null)
  const pendingPromptRef = useRef<string | null>(null)
  const iterCancelRef = useRef(false)
  const [showScrollPill, setShowScrollPill] = useState(false)
  const [detectedKeywords, setDetectedKeywords] = useState<KeywordMatch[]>([])
  const [termHeight, setTermHeight] = useState(256)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const { success: toastSuccess } = useToast()

  const scrollToBottom = () => scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)

  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
    setShowScrollPill(!atBottom)
  }, [])

  const handleClear = useCallback(() => {
    setLiveOutput([])
    setLastAssistantText(null)
  }, [])

  const handleCopyLast = useCallback(() => {
    if (lastAssistantText) {
      void navigator.clipboard.writeText(lastAssistantText)
      toastSuccess('Copied to clipboard')
    }
  }, [lastAssistantText, toastSuccess])

  // Ctrl+F search within terminal
  useEffect(() => {
    const el = scrollRef.current?.parentElement
    if (!el) return
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault()
        e.stopPropagation()
        setShowSearch(v => !v)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape' && showSearch) {
        setShowSearch(false)
        setSearchQuery('')
      }
    }
    el.addEventListener('keydown', handler)
    return () => el.removeEventListener('keydown', handler)
  }, [showSearch])

  // Drag-to-resize terminal
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startY = e.clientY
    const startH = termHeight
    const onMove = (ev: MouseEvent) => {
      const delta = ev.clientY - startY
      setTermHeight(Math.max(128, Math.min(800, startH + delta)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [termHeight])

  // Highlight search matches in text
  const highlightText = useCallback((text: string) => {
    if (!searchQuery || !showSearch) return text
    const escaped = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
    if (parts.length === 1) return text
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase()
        ? <mark key={i} className="bg-amber/30 text-white rounded px-0.5">{part}</mark>
        : part
    )
  }, [searchQuery, showSearch])

  const sendPrompt = async (explicitPrompt?: string) => {
    const prompt = explicitPrompt ?? input.trim()
    if (!prompt || streaming) return

    // Read fresh state to avoid stale prop issues
    const freshState = useStore.getState()
    const freshAgent = freshState.agents.find(a => a.id === agent.id)

    // Budget gates (extracted)
    const budgetCheck = checkBudgetGates(
      freshAgent?.budgetCap ?? agent.budgetCap,
      freshAgent?.sessionCost ?? agent.sessionCost,
      freshState.dailyBudgetCap,
      freshState.dailySpend,
    )
    if (budgetCheck.blocked) {
      appendMessage(agent.id, { id: `msg-${Date.now()}-bg`, role: 'system', content: budgetCheck.message!, timestamp: Date.now() })
      return
    }

    // Atomic spawn lock — check+set via store to prevent cross-instance races
    if (freshAgent?.isStreaming) return
    useStore.getState().updateAgent(agent.id, { isStreaming: true })

    if (!explicitPrompt) setInput('')
    iterCancelRef.current = false
    setStreaming(true)
    setLiveOutput([])

    appendMessage(agent.id, { id: `msg-${Date.now()}`, role: 'user', content: prompt, timestamp: Date.now() })
    updateAgent(agent.id, {
      status: 'running', lastUpdate: Date.now(), isStreaming: true,
      ...(agent.sessionStartedAt == null ? { sessionStartedAt: Date.now() } : {}),
    })

    // Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Injection pipeline (extracted)
    const { effectivePrompt, messages: injMsgs, agentUpdates: kwUpdates } = await buildEffectivePrompt(prompt, agent)
    for (const m of injMsgs) {
      appendMessage(agent.id, { ...m, role: 'system', timestamp: Date.now() })
    }
    if (Object.keys(kwUpdates).length > 0) updateAgent(agent.id, kwUpdates)

    // Worktree creation (extracted)
    const { effectivePath, worktreeUpdate } = await createWorktreeIfNeeded(agent)
    if (worktreeUpdate) updateAgent(agent.id, worktreeUpdate)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id, repoPath: effectivePath, prompt: effectivePrompt,
          sessionId: agent.sessionId,
          ...(agent.model !== 'default' ? { model: agent.model } : {}),
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
          try {
            const msg: StreamMessage = JSON.parse(line.slice(6))
            setLiveOutput(prev => [...prev, msg])
            scrollToBottom()

            if (msg.sessionId) updateAgent(agent.id, { sessionId: msg.sessionId })

            if (msg.type === 'result') {
              const finalText = msg.text || ''
              setLastAssistantText(finalText)
              appendMessage(agent.id, { id: `msg-${Date.now()}`, role: 'assistant', content: finalText, timestamp: Date.now() })

              // Fresh state reads to avoid stale closures
              const fs = useStore.getState().agents.find(a => a.id === agent.id)
              const result = handleResultMessage({
                finalText, msg,
                prevCost: fs?.sessionCost ?? agent.sessionCost ?? 0,
                prevTurns: fs?.sessionTurns ?? agent.sessionTurns ?? 0,
                prevTokens: fs?.sessionTokens ?? agent.sessionTokens ?? 0,
                budgetCap: fs?.budgetCap ?? agent.budgetCap,
                autoIterate: fs?.autoIterate ?? agent.autoIterate,
                iterateThreshold: fs?.iterateThreshold ?? agent.iterateThreshold,
                iterateMaxRounds: fs?.iterateMaxRounds ?? agent.iterateMaxRounds,
                iterState: iterRef.current, agentName: agent.name,
              })

              // Apply stats
              updateAgent(agent.id, { status: 'done', lastUpdate: Date.now(), isStreaming: false, ...result.statsUpdate })
              if (msg.cost) useStore.getState().addDailySpend(new Date().toISOString().slice(0, 10), msg.cost)
              if (result.score != null) updateAgent(agent.id, { score: result.score, iterationScore: result.score })

              // Budget exceeded → kill
              if (result.budgetExceeded) {
                if (result.budgetMessage) appendMessage(agent.id, { id: `msg-${Date.now()}-bc`, role: 'system', content: result.budgetMessage, timestamp: Date.now() })
                fetch('/api/kill', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agentId: agent.id }) }).catch(() => {})
                iterRef.current = null; pendingPromptRef.current = null; iterCancelRef.current = true
                updateAgent(agent.id, { status: 'error', isStreaming: false, iterationRound: 0 })
              } else {
                // Auto-iterate state
                iterRef.current = result.nextIterState
                pendingPromptRef.current = result.pendingPrompt
                updateAgent(agent.id, { iterationRound: result.nextIterState?.round ?? 0 })
                if (result.iterMessage) appendMessage(agent.id, { id: `msg-${Date.now()}-ai`, role: 'system', content: result.iterMessage, timestamp: Date.now() })
                if (result.notification && 'Notification' in window && Notification.permission === 'granted') {
                  new Notification(result.notification.title, { body: result.notification.body, icon: '/favicon.ico', tag: agent.id })
                }
              }

              // Auto-complete voyage task
              const voyage = useStore.getState().voyage
              if (voyage) {
                const task = voyage.tasks.find(t => t.agentId === agent.id && !t.completed)
                if (task) useStore.getState().toggleVoyageTask(task.id)
              }
            }

            if (msg.type === 'done') updateAgent(agent.id, { isStreaming: false })
            if (msg.type === 'error') {
              updateAgent(agent.id, { status: 'error', isStreaming: false, lastUpdate: Date.now() })
              appendMessage(agent.id, { id: `msg-${Date.now()}`, role: 'system', content: `Error: ${msg.content}`, timestamp: Date.now() })
            }
          } catch (e) {
            console.warn('Failed to parse SSE line:', e instanceof Error ? e.message : String(e))
          }
        }
      }
    } catch (e: unknown) {
      if (!(e instanceof Error) || e.name !== 'AbortError') {
        appendMessage(agent.id, { id: `msg-${Date.now()}`, role: 'system', content: `Connection error: ${e instanceof Error ? e.message : String(e)}`, timestamp: Date.now() })
        updateAgent(agent.id, { status: 'error', isStreaming: false })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
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
    setInput('Continue where you left off.')
    inputRef.current?.focus()
  }

  // Auto-focus input when requested (e.g. QM panel)
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus()
  }, [autoFocus])

  // Pick up prompts injected by the reactions engine.
  // Uses atomic check-and-clear via getState() to prevent duplicate sends
  // if two StreamingTerminal instances exist for the same agent (e.g. QmChatPanel + AgentCard).
  useEffect(() => {
    if (agent.pendingTrigger && !streaming) {
      const state = useStore.getState()
      const fresh = state.agents.find(a => a.id === agent.id)
      if (!fresh?.pendingTrigger) return // another instance already consumed it
      const prompt = fresh.pendingTrigger
      state.updateAgent(agent.id, { pendingTrigger: null })
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

    // Block launch if daily budget cap exceeded
    if (state.dailyBudgetCap != null) {
      const today = new Date().toISOString().slice(0, 10)
      const todaySpend = state.dailySpend[today] ?? 0
      if (todaySpend >= state.dailyBudgetCap) {
        state.setVoyagePendingLaunch(state.voyagePendingLaunch.filter(id => id !== agent.id))
        appendMessage(agent.id, {
          id: `msg-${Date.now()}-dg`,
          role: 'system',
          content: `🚫 Launch blocked — daily fleet budget $${state.dailyBudgetCap.toFixed(2)} reached. Raise daily cap to launch.`,
          timestamp: Date.now(),
        })
        return
      }
    }

    // Remove this agent from the pending list
    state.setVoyagePendingLaunch(state.voyagePendingLaunch.filter(id => id !== agent.id))

    // Build the auto-launch prompt with treasure map + mission
    const voyage = state.voyage
    const missionTasks = voyage?.tasks.filter(t => t.agentId === agent.id).map(t => t.name) ?? []
    // Extract territory from task description if present
    const territoryMatch = agent.task.match(/\[TERRITORY: (.+?)\]/)
    const territory = territoryMatch?.[1] ?? null

    const prompt = [
      voyage?.treasureMap ? `[TREASURE MAP]\n${voyage.treasureMap}` : '',
      `\n[YOUR MISSION]\nYou are ${agent.name}, the ${agent.role} of this crew.`,
      missionTasks.length > 0 ? `Your assigned tasks:\n${missionTasks.map(t => `- ${t}`).join('\n')}` : '',
      agent.task ? `\nDescription: ${agent.task}` : '',
      territory ? `\n[YOUR TERRITORY]\nYou are responsible for these files/directories:\n${territory.split(', ').map(t => `- ${t}`).join('\n')}\n\nStay within your territory. Do NOT modify files outside these paths unless absolutely necessary. If you need changes outside your territory, send a signal to the appropriate crew member.` : '',
      '\nBegin working on your tasks. Start with the highest priority items.',
    ].filter(Boolean).join('\n')

    // Stagger launch slightly to avoid race conditions
    const delay = Math.random() * 2000
    setTimeout(() => void sendPrompt(prompt), delay)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={`border-t border-white/5 ${fillHeight ? 'flex-1 flex flex-col min-h-0' : ''}`}>
      <SessionStatsBar agent={agent} streaming={streaming} />

      {/* Terminal actions */}
      <div className="flex items-center gap-1 px-3 py-1 border-b border-white/5 bg-black/20">
        <button onClick={handleClear} className="text-xs text-white/20 hover:text-white/50 transition-all px-1.5 py-0.5 rounded hover:bg-white/5" title="Clear terminal output" aria-label="Clear terminal output">Clear</button>
        {lastAssistantText && (
          <button onClick={handleCopyLast} className="text-xs text-white/20 hover:text-white/50 transition-all px-1.5 py-0.5 rounded hover:bg-white/5" title="Copy last response" aria-label="Copy last response">Copy</button>
        )}
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-3 py-1 border-b border-white/5 bg-black/20">
          <span className="text-xs text-white/30">Find:</span>
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setShowSearch(false); setSearchQuery('') } }}
            className="flex-1 text-xs bg-transparent border-b border-white/10 outline-none text-white/70 placeholder:text-white/15 py-0.5"
            placeholder="Search terminal output..."
          />
          <button onClick={() => { setShowSearch(false); setSearchQuery('') }} className="text-xs text-white/20 hover:text-white/50" aria-label="Close search">✕</button>
        </div>
      )}

      {/* Message history + live stream */}
      <div ref={scrollRef} onScroll={handleScroll} role="log" aria-live="polite" className={`${fillHeight ? 'flex-1 min-h-0' : ''} overflow-y-auto p-3 space-y-1.5 bg-black/30 font-mono text-xs relative`} style={fillHeight ? undefined : { height: termHeight }}>
        {agent.messages.length === 0 && liveOutput.length === 0 && (
          <div className="opacity-15 text-center py-12">{t(`Give orders to start this pirate in ${agent.repo}...`, `Enter a prompt to start this agent in ${agent.repo}...`)}</div>
        )}

        {/* Historical messages */}
        {agent.messages.map(m => {
          const isError = m.role === 'system' && (m.content.startsWith('🚫') || m.content.startsWith('Error:') || m.content.startsWith('Connection error:'))
          return (
            <div key={m.id} className={`${m.role === 'user' ? 'text-amber' : m.role === 'system' ? 'text-white/25 italic' : 'text-white/70'} ${isError ? 'bg-red-500/[0.06] border border-red-500/10 rounded px-2 py-1 text-red-400/80' : ''}`}>
              <span className="opacity-30 mr-2 tabular-nums">
                {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="opacity-40 mr-1">{m.role === 'user' ? '>' : m.role === 'system' ? '#' : '←'}</span>
              <span className="whitespace-pre-wrap break-all">{highlightText(m.content.slice(0, 3000))}{m.content.length > 3000 ? '\n...(truncated)' : ''}</span>
            </div>
          )
        })}

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
            {msg.type === 'error' && <span className="text-red-400 bg-red-500/[0.06] border border-red-500/10 rounded px-2 py-1 inline-block">✗ {msg.content}</span>}
          </div>
        ))}

        {streaming && (
          <div className="text-green-400/60 animate-pulse flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
            {agent.iterationRound > 0 ? t(`Keep Sailing (round ${agent.iterationRound})...`, `Auto-iterating (round ${agent.iterationRound})...`) : t('Pirate is sailing...', 'Agent is running...')}
          </div>
        )}
      </div>

      {/* Scroll to bottom pill */}
      {showScrollPill && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute -top-8 left-1/2 -translate-x-1/2 z-10 text-xs px-3 py-1 rounded-full bg-white/10 text-white/50 hover:text-white/80 border border-white/10 backdrop-blur-sm transition-all hover:bg-white/15"
            aria-label="Scroll to latest output"
          >
            ↓ Latest
          </button>
        </div>
      )}

      {/* Drag handle for resizing terminal */}
      {!fillHeight && (
        <div
          onMouseDown={handleDragStart}
          className="h-1.5 cursor-ns-resize bg-white/[0.03] hover:bg-white/[0.08] transition-colors border-y border-white/5 flex items-center justify-center"
          title="Drag to resize terminal"
          aria-label="Resize terminal"
          role="separator"
        >
          <span className="w-8 h-0.5 rounded-full bg-white/10" />
        </div>
      )}

      {/* Keyword badges */}
      {detectedKeywords.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1 border-t border-white/5">
          {detectedKeywords.map(m => (
            <span key={m.keyword}
              className="text-[10px] px-1.5 py-0.5 rounded font-mono"
              style={{ backgroundColor: m.color + '20', color: m.color, border: `1px solid ${m.color}33` }}>
              {m.label}
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-white/5">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => {
            setInput(e.target.value)
            setDetectedKeywords(detectKeywords(e.target.value))
          }}
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
        {!streaming && agent.agentType === 'quartermaster' && lastAssistantText && (
          <button
            onClick={() => {
              const title = `Fleet_Research_${new Date().toISOString().slice(0, 10)}`
              void fetch('/api/vault', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title, content: lastAssistantText, folder: '2_ResourceLedger/2.4_Research' }),
              }).then(async (res) => {
                const data = await res.json()
                appendMessage(agent.id, {
                  id: `msg-${Date.now()}-vs`,
                  role: 'system',
                  content: (data as { success: boolean; filename?: string; error?: string }).success
                    ? `📚 Saved to vault: ${(data as { filename: string }).filename}`
                    : `Failed to save to vault: ${(data as { error?: string }).error ?? 'unknown'}`,
                  timestamp: Date.now(),
                })
                if ((data as { success: boolean }).success) setLastAssistantText(null)
              })
            }}
            className="text-xs px-2 py-1.5 rounded bg-emerald-500/15 text-emerald-400/80 border border-emerald-500/20 hover:bg-emerald-500/25 transition-all"
            title="Save last response as a note in the Obsidian vault">
            {t('📚 Stash in Vault', '📚→ Vault')}
          </button>
        )}
        {streaming ? (
          <button onClick={stopAgent}
            className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all"
            title="Stop Agent" aria-label="Stop agent">
            <PT k="All Stop!" className="border-0" />
          </button>
        ) : (
          <button onClick={() => void sendPrompt()} disabled={!input.trim()}
            className="btn-primary" title="Send Prompt" aria-label="Send prompt">
            <PT k="Fire!" className="border-0" />
          </button>
        )}
      </div>
    </div>
  )
}
