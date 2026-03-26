import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { createMutex } from '@/lib/mutex'

const SignalTypeSchema = z.enum(['handoff', 'blocker', 'update', 'request', 'done'])

const CreateSignalSchema = z.object({
  from: z.string().min(1).max(200),
  to: z.string().min(1).max(200),
  type: SignalTypeSchema,
  message: z.string().min(1).max(10_000),
})

const ResolveSignalSchema = z.object({ signalId: z.string().min(1).max(128) })

// Signals are stored locally in the Fleet project directory by default.
// Override with SIGNALS_DIR env var to share signals across machines or store elsewhere.
const SIGNALS_DIR = process.env.SIGNALS_DIR || path.join(process.cwd(), '.fleet', 'signals')

interface Signal {
  id: string
  from: string       // agent name
  to: string         // agent name or '*' for broadcast
  type: 'handoff' | 'blocker' | 'update' | 'request' | 'done'
  message: string
  timestamp: number
  resolved: boolean
}

function ensureDir() {
  if (!existsSync(SIGNALS_DIR)) {
    mkdirSync(SIGNALS_DIR, { recursive: true })
  }
}

function getSignalsFile() {
  return path.join(SIGNALS_DIR, 'signals.json')
}

function readSignals(): Signal[] {
  ensureDir()
  const file = getSignalsFile()
  if (!existsSync(file)) return []
  try {
    return JSON.parse(readFileSync(file, 'utf-8'))
  } catch (e) {
    console.warn('Failed to parse signals file:', e instanceof Error ? e.message : String(e))
    return []
  }
}

function writeSignals(signals: Signal[]) {
  ensureDir()
  writeFileSync(getSignalsFile(), JSON.stringify(signals, null, 2), 'utf-8')
}

const signalsMutex = createMutex()

// GET: read all signals, optionally filter by agent
export async function GET(req: NextRequest) {
  const agentName = req.nextUrl.searchParams.get('agent')
  const unresolvedOnly = req.nextUrl.searchParams.get('unresolved') === 'true'

  let signals = readSignals()

  if (agentName) {
    signals = signals.filter(s => s.to === agentName || s.to === '*' || s.from === agentName)
  }
  if (unresolvedOnly) {
    signals = signals.filter(s => !s.resolved)
  }

  return NextResponse.json({ signals })
}

// POST: create a new signal
export async function POST(req: NextRequest) {
  const parsed = CreateSignalSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { from, to, type, message } = parsed.data

  const release = await signalsMutex.acquire()
  try {
    const signals = readSignals()
    const signal: Signal = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
      type,
      message,
      timestamp: Date.now(),
      resolved: false,
    }
    signals.push(signal)
    writeSignals(signals)
    return NextResponse.json({ success: true, signal })
  } finally {
    release()
  }
}

// PATCH: resolve a signal
export async function PATCH(req: NextRequest) {
  const parsed = ResolveSignalSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { signalId } = parsed.data

  const release = await signalsMutex.acquire()
  try {
    const signals = readSignals()
    const idx = signals.findIndex(s => s.id === signalId)
    const found = idx !== -1 ? signals[idx] : undefined
    if (!found) {
      return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
    }
    found.resolved = true
    writeSignals(signals)
    return NextResponse.json({ success: true })
  } finally {
    release()
  }
}
