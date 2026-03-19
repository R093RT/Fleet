import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { liveProcesses } from '@/lib/process-registry'

const KillSchema = z.object({ agentId: z.string() })

export async function DELETE(req: NextRequest) {
  const parsed = KillSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId } = parsed.data

  const proc = liveProcesses.get(agentId)
  if (proc) {
    try { proc.kill() } catch {}
    liveProcesses.delete(agentId)
  }

  return NextResponse.json({ success: true, killed: !!proc })
}
