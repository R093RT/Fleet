import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWithRetry } from './fetch-retry'

describe('fetchWithRetry', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('returns on first success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }))
    const res = await fetchWithRetry('/test')
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on 500 and succeeds', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const res = await fetchWithRetry('/test', undefined, { retries: 2, backoffMs: 10 })
    expect(res.status).toBe(200)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('returns last 500 response after exhausting retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('err', { status: 500 }))
    const res = await fetchWithRetry('/test', undefined, { retries: 1, backoffMs: 10 })
    expect(res.status).toBe(500)
    expect(globalThis.fetch).toHaveBeenCalledTimes(2)
  })

  it('does not retry on 4xx', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(new Response('bad', { status: 400 }))
    const res = await fetchWithRetry('/test', undefined, { retries: 2, backoffMs: 10 })
    expect(res.status).toBe(400)
    expect(globalThis.fetch).toHaveBeenCalledTimes(1)
  })

  it('retries on network error and succeeds', async () => {
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    const res = await fetchWithRetry('/test', undefined, { retries: 2, backoffMs: 10 })
    expect(res.status).toBe(200)
  })

  it('throws after exhausting retries on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('network'))
    await expect(fetchWithRetry('/test', undefined, { retries: 1, backoffMs: 10 })).rejects.toThrow('network')
  })
})
