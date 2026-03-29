import { NextRequest, NextResponse } from 'next/server'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { atomicWriteFileSync, safeReadJson } from '@/lib/atomic-write'
import { withFileLock } from '@/lib/file-lock'
import { pruneSignals } from '@/lib/signals'
import type { Signal } from '@/lib/signals'

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
  return safeReadJson<Signal[]>(getSignalsFile()) ?? []
}

function writeSignals(signals: Signal[]) {
  ensureDir()
  const pruned = pruneSignals(signals)
  atomicWriteFileSync(getSignalsFile(), JSON.stringify(pruned, null, 2))
}

const LOCK_PATH = path.join(SIGNALS_DIR, 'signals.lock')

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

  const signal = await withFileLock(LOCK_PATH, () => {
    const signals = readSignals()
    const sig: Signal = {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      from,
      to,
      type,
      message,
      timestamp: Date.now(),
      resolved: false,
    }
    signals.push(sig)
    writeSignals(signals)
    return sig
  })
  return NextResponse.json({ success: true, signal })
}

// PATCH: resolve a signal
export async function PATCH(req: NextRequest) {
  const parsed = ResolveSignalSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { signalId } = parsed.data

  const notFound = await withFileLock(LOCK_PATH, () => {
    const signals = readSignals()
    const idx = signals.findIndex(s => s.id === signalId)
    const found = idx !== -1 ? signals[idx] : undefined
    if (!found) return true
    found.resolved = true
    writeSignals(signals)
    return false
  })

  if (notFound) {
    return NextResponse.json({ error: 'Signal not found' }, { status: 404 })
  }
  return NextResponse.json({ success: true })
}
