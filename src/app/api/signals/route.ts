import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import path from 'path'

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
  } catch {
    return []
  }
}

function writeSignals(signals: Signal[]) {
  ensureDir()
  writeFileSync(getSignalsFile(), JSON.stringify(signals, null, 2), 'utf-8')
}

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
  const { from, to, type, message } = await req.json() as Omit<Signal, 'id' | 'timestamp' | 'resolved'>

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
}

// PATCH: resolve a signal
export async function PATCH(req: NextRequest) {
  const { signalId } = await req.json() as { signalId: string }

  const signals = readSignals()
  const idx = signals.findIndex(s => s.id === signalId)
  if (idx === -1) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }
  signals[idx].resolved = true
  writeSignals(signals)

  return NextResponse.json({ success: true })
}
