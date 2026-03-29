import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock process-registry before importing the route
vi.mock('@/lib/process-registry', () => {
  const map = new Map()
  return { liveProcesses: map }
})

vi.mock('@/lib/process-reaper', () => ({
  reapOrphanProcesses: vi.fn(() => []),
}))

import { GET } from './route'
import { liveProcesses } from '@/lib/process-registry'
import { reapOrphanProcesses } from '@/lib/process-reaper'

beforeEach(() => {
  liveProcesses.clear()
  vi.mocked(reapOrphanProcesses).mockReturnValue([])
})

describe('GET /api/health', () => {
  it('returns liveProcesses count and reaped list', async () => {
    const res = await GET()
    const json = await res.json()
    expect(json).toEqual({ liveProcesses: 0, reaped: [] })
  })

  it('reflects reaped agents from reaper', async () => {
    vi.mocked(reapOrphanProcesses).mockReturnValue(['agent-1', 'agent-2'])
    const res = await GET()
    const json = await res.json()
    expect(json.reaped).toEqual(['agent-1', 'agent-2'])
  })

  it('calls reapOrphanProcesses with liveProcesses', async () => {
    await GET()
    expect(reapOrphanProcesses).toHaveBeenCalledWith(liveProcesses)
  })
})
