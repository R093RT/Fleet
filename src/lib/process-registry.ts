import type { ChildProcess } from 'child_process'

// Module-level singleton — persists across requests within the same Next.js server process.
// Keyed by agentId. Populated by /api/stream when a process is spawned.
export const liveProcesses = new Map<string, ChildProcess>()
