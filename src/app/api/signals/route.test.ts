import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
}))

import { GET, POST, PATCH } from './route'
import * as fs from 'fs'

function makeRequest(url: string, init?: Record<string, unknown>): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:4000'), init as never)
}

function jsonBody(data: unknown) {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }
}

function seedSignals(signals: unknown[]) {
  vi.mocked(fs.existsSync).mockReturnValue(true)
  vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(signals))
}

describe('Signals API route', () => {
  beforeEach(() => {
    vi.mocked(fs.readFileSync).mockImplementation(() => { throw new Error('ENOENT') })
    vi.mocked(fs.writeFileSync).mockImplementation(() => {})
    vi.mocked(fs.existsSync).mockImplementation((p) => String(p).endsWith('signals'))
    vi.mocked(fs.mkdirSync).mockImplementation(() => undefined as unknown as string)
  })

  // === GET ===

  it('GET returns empty signals when file does not exist', async () => {
    const res = await GET(makeRequest('http://localhost:4000/api/signals'))
    const data = await res.json()
    expect(data.signals).toEqual([])
  })

  it('GET returns all signals', async () => {
    seedSignals([
      { id: 'sig-1', from: 'a', to: 'b', type: 'update', message: 'hi', timestamp: Date.now(), resolved: false },
    ])
    const res = await GET(makeRequest('http://localhost:4000/api/signals'))
    const data = await res.json()
    expect(data.signals).toHaveLength(1)
    expect(data.signals[0].id).toBe('sig-1')
  })

  it('GET filters by agent name', async () => {
    seedSignals([
      { id: 'sig-1', from: 'a', to: 'b', type: 'update', message: 'hi', timestamp: Date.now(), resolved: false },
      { id: 'sig-2', from: 'c', to: 'd', type: 'update', message: 'hi', timestamp: Date.now(), resolved: false },
    ])
    const res = await GET(makeRequest('http://localhost:4000/api/signals?agent=b'))
    const data = await res.json()
    expect(data.signals).toHaveLength(1)
    expect(data.signals[0].id).toBe('sig-1')
  })

  it('GET includes broadcast signals for any agent filter', async () => {
    seedSignals([
      { id: 'sig-1', from: 'a', to: '*', type: 'update', message: 'broadcast', timestamp: Date.now(), resolved: false },
      { id: 'sig-2', from: 'c', to: 'd', type: 'update', message: 'private', timestamp: Date.now(), resolved: false },
    ])
    const res = await GET(makeRequest('http://localhost:4000/api/signals?agent=x'))
    const data = await res.json()
    expect(data.signals).toHaveLength(1)
    expect(data.signals[0].id).toBe('sig-1')
  })

  it('GET filters unresolved only', async () => {
    seedSignals([
      { id: 'sig-1', from: 'a', to: 'b', type: 'update', message: 'hi', timestamp: Date.now(), resolved: true },
      { id: 'sig-2', from: 'a', to: 'b', type: 'update', message: 'hi', timestamp: Date.now(), resolved: false },
    ])
    const res = await GET(makeRequest('http://localhost:4000/api/signals?unresolved=true'))
    const data = await res.json()
    expect(data.signals).toHaveLength(1)
    expect(data.signals[0].id).toBe('sig-2')
  })

  it('GET recovers from corrupt JSON', async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true)
    vi.mocked(fs.readFileSync).mockReturnValue('not valid json{{{')
    const res = await GET(makeRequest('http://localhost:4000/api/signals'))
    const data = await res.json()
    expect(data.signals).toEqual([])
  })

  // === POST ===

  it('POST creates a signal with correct fields', async () => {
    const res = await POST(makeRequest('http://localhost:4000/api/signals', jsonBody({
      from: 'agent-a', to: 'agent-b', type: 'handoff', message: 'take over',
    })))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.signal.from).toBe('agent-a')
    expect(data.signal.to).toBe('agent-b')
    expect(data.signal.type).toBe('handoff')
    expect(data.signal.message).toBe('take over')
    expect(data.signal.resolved).toBe(false)
    expect(data.signal.id).toMatch(/^sig-/)
  })

  it('POST validates Zod schema — missing fields', async () => {
    const res = await POST(makeRequest('http://localhost:4000/api/signals', jsonBody({ from: 'a' })))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Invalid request')
  })

  it('POST returns 400 on invalid signal type', async () => {
    const res = await POST(makeRequest('http://localhost:4000/api/signals', jsonBody({
      from: 'a', to: 'b', type: 'invalid_type', message: 'test',
    })))
    expect(res.status).toBe(400)
  })

  it('POST returns 400 on empty from/to', async () => {
    const res = await POST(makeRequest('http://localhost:4000/api/signals', jsonBody({
      from: '', to: '', type: 'update', message: 'test',
    })))
    expect(res.status).toBe(400)
  })

  // === PATCH ===

  it('PATCH resolves a signal by ID', async () => {
    seedSignals([
      { id: 'sig-abc', from: 'a', to: 'b', type: 'update', message: 'hi', timestamp: Date.now(), resolved: false },
    ])
    let written = ''
    vi.mocked(fs.writeFileSync).mockImplementation((_p, data) => { written = data as string })

    const res = await PATCH(makeRequest('http://localhost:4000/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: 'sig-abc' }),
    }))
    const data = await res.json()
    expect(data.success).toBe(true)
    const saved = JSON.parse(written)
    expect(saved[0].resolved).toBe(true)
  })

  it('PATCH returns 404 on unknown signal ID', async () => {
    seedSignals([])
    const res = await PATCH(makeRequest('http://localhost:4000/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signalId: 'nonexistent' }),
    }))
    expect(res.status).toBe(404)
  })

  it('PATCH returns 400 on missing signalId', async () => {
    const res = await PATCH(makeRequest('http://localhost:4000/api/signals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }))
    expect(res.status).toBe(400)
  })
})
