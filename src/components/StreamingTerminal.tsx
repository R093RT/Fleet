'use client'

import { useState, useEffect, useRef } from 'react'
import { useStore, type Agent } from '@/lib/store'

interface StreamMessage {
  type: 'assistant' | 'result' | 'system' | 'tool_result' | 'text' | 'stderr' | 'done' | 'error'
  agentId: string
  text?: string
  content?: string
  toolUses?: { tool: string; input: any }[]
  sessionId?: string | null
  subtype?: string
  cost?: number | null
  exitCode?: number
}

export function StreamingTerminal({ agent }: { agent: Agent }) {
  const { updateAgent, appendMessage } = useStore()
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [liveOutput, setLiveOutput] = useState<StreamMessage[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight)
  }, [liveOutput, agent.messages])

  const sendPrompt = async () => {
    if (!input.trim() || streaming) return
    const prompt = input.trim()
    setInput('')
    setStreaming(true)
    setLiveOutput([])

    appendMessage(agent.id, {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: Date.now(),
    })

    updateAgent(agent.id, { status: 'running', lastUpdate: Date.now(), isStreaming: true })

    // Request desktop notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: agent.id,
          repoPath: agent.path,
          prompt,
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

            // Update session ID
            if (msg.sessionId) {
              updateAgent(agent.id, { sessionId: msg.sessionId })
            }

            // Handle completion
            if (msg.type === 'result') {
              const finalText = msg.text || ''
              appendMessage(agent.id, {
                id: `msg-${Date.now()}`,
                role: 'assistant',
                content: finalText,
                timestamp: Date.now(),
              })
              updateAgent(agent.id, {
                status: 'done',
                lastUpdate: Date.now(),
                isStreaming: false,
              })

              // Desktop notification
              if ('Notification' in window && Notification.permission === 'granted') {
                new Notification(`${agent.name} finished`, {
                  body: finalText.slice(0, 100) + (finalText.length > 100 ? '...' : ''),
                  icon: '/favicon.ico',
                  tag: agent.id,
                })
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
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        appendMessage(agent.id, {
          id: `msg-${Date.now()}`,
          role: 'system',
          content: `Connection error: ${e.message}`,
          timestamp: Date.now(),
        })
        updateAgent(agent.id, { status: 'error', isStreaming: false })
      }
    } finally {
      setStreaming(false)
      abortRef.current = null
    }
  }

  const stopAgent = () => {
    abortRef.current?.abort()
    setStreaming(false)
    updateAgent(agent.id, { status: 'idle', isStreaming: false })
  }

  return (
    <div className="border-t border-white/5">
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
              </div>
            )}
            {msg.type === 'stderr' && <span className="ml-2">stderr: {msg.content}</span>}
            {msg.type === 'error' && <span className="text-red-400">✗ {msg.content}</span>}
          </div>
        ))}

        {streaming && (
          <div className="text-green-400/60 animate-pulse flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-ping" />
            Agent is working...
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 p-2 border-t border-white/5">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendPrompt()}
          placeholder={agent.sessionId ? 'Follow-up (session active)...' : 'Initial prompt...'}
          disabled={streaming}
          className="flex-1 text-sm bg-white/5 border border-white/8 rounded px-3 py-1.5 text-white/90 placeholder:text-white/15 outline-none focus:border-white/20 disabled:opacity-30"
        />
        {streaming ? (
          <button onClick={stopAgent}
            className="text-xs px-3 py-1.5 rounded bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">
            Stop
          </button>
        ) : (
          <button onClick={sendPrompt} disabled={!input.trim()}
            className="text-xs px-3 py-1.5 rounded font-medium disabled:opacity-20 transition-all"
            style={{ backgroundColor: 'rgba(212,168,67,0.2)', color: '#d4a843', border: '1px solid rgba(212,168,67,0.3)' }}>
            Send
          </button>
        )}
      </div>
    </div>
  )
}
