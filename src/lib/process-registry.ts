import type { ChildProcess } from 'child_process'
import { startReaper } from './process-reaper'

// globalThis singleton — survives Next.js HMR in dev mode.
// Same pattern used by Prisma, documented in Next.js docs.
const g = globalThis as unknown as {
  __fleet_liveProcesses?: Map<string, ChildProcess>
  __fleet_shutdownRegistered?: boolean
}

// Keyed by agentId. Populated by /api/stream when a process is spawned.
export const liveProcesses = g.__fleet_liveProcesses ??= new Map<string, ChildProcess>()

// Start background reaper (idempotent — only one interval across HMR reloads)
startReaper(liveProcesses)

// Graceful shutdown — kill all child processes on server exit
function shutdownAllProcesses() {
  for (const [, proc] of liveProcesses) {
    try { proc.kill('SIGTERM') } catch {}
  }
  liveProcesses.clear()
}

if (!g.__fleet_shutdownRegistered) {
  g.__fleet_shutdownRegistered = true
  process.on('SIGTERM', shutdownAllProcesses)
  process.on('SIGINT', shutdownAllProcesses)
}
