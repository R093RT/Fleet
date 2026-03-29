import { NextResponse } from 'next/server'
import { liveProcesses } from '@/lib/process-registry'
import { reapOrphanProcesses } from '@/lib/process-reaper'

export async function GET() {
  const reaped = reapOrphanProcesses(liveProcesses)
  return NextResponse.json({
    liveProcesses: liveProcesses.size,
    reaped,
  })
}
