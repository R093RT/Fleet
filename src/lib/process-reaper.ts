import type { ChildProcess } from 'child_process'

/** Check if a process with the given PID is still alive. */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e: unknown) {
    // EPERM = alive but no permission to signal
    if (e instanceof Error && 'code' in e && (e as NodeJS.ErrnoException).code === 'EPERM') {
      return true
    }
    // ESRCH = no such process
    return false
  }
}

/** Iterate liveProcesses, remove entries whose PIDs are dead. Returns reaped agentIds. */
export function reapOrphanProcesses(liveProcesses: Map<string, ChildProcess>): string[] {
  const reaped: string[] = []
  for (const [agentId, proc] of liveProcesses) {
    const pid = proc.pid
    if (pid == null || !isProcessAlive(pid)) {
      liveProcesses.delete(agentId)
      reaped.push(agentId)
    }
  }
  return reaped
}

// globalThis guard so the interval survives HMR
const g = globalThis as unknown as { __fleet_reaperStarted?: boolean }

/** Start the background reaper interval. Idempotent — safe to call multiple times. */
export function startReaper(liveProcesses: Map<string, ChildProcess>, intervalMs = 30_000): void {
  if (g.__fleet_reaperStarted) return
  g.__fleet_reaperStarted = true
  setInterval(() => reapOrphanProcesses(liveProcesses), intervalMs).unref()
}
