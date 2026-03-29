import { describe, it, expect, beforeEach } from 'vitest'
import { isProcessAlive, reapOrphanProcesses } from './process-reaper'
import { liveProcesses } from './process-registry'

beforeEach(() => {
  liveProcesses.clear()
})

describe('isProcessAlive', () => {
  it('returns true for the current process', () => {
    expect(isProcessAlive(process.pid)).toBe(true)
  })

  it('returns false for a non-existent PID', () => {
    // PID 99999999 is almost certainly not running
    expect(isProcessAlive(99_999_999)).toBe(false)
  })
})

describe('reapOrphanProcesses', () => {
  it('returns empty array when no processes are tracked', () => {
    expect(reapOrphanProcesses(liveProcesses)).toEqual([])
  })

  it('reaps entries with null pid', () => {
    // Simulate a process entry with no PID (spawn failed)
    liveProcesses.set('agent-no-pid', { pid: undefined } as never)
    const reaped = reapOrphanProcesses(liveProcesses)
    expect(reaped).toContain('agent-no-pid')
    expect(liveProcesses.has('agent-no-pid')).toBe(false)
  })

  it('reaps entries with dead PIDs', () => {
    liveProcesses.set('agent-dead', { pid: 99_999_999 } as never)
    const reaped = reapOrphanProcesses(liveProcesses)
    expect(reaped).toContain('agent-dead')
    expect(liveProcesses.has('agent-dead')).toBe(false)
  })

  it('keeps entries with alive PIDs', () => {
    liveProcesses.set('agent-alive', { pid: process.pid } as never)
    const reaped = reapOrphanProcesses(liveProcesses)
    expect(reaped).not.toContain('agent-alive')
    expect(liveProcesses.has('agent-alive')).toBe(true)
    liveProcesses.delete('agent-alive')
  })
})
