import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// The route uses promisify(execFile). We attach the custom promisify symbol
// so that promisify(execFile) returns our controllable async mock.
const { execFileAsyncMock } = vi.hoisted(() => ({
  execFileAsyncMock: vi.fn<(cmd: string, args: string[], opts: unknown) => Promise<{ stdout: string; stderr: string }>>(),
}))

vi.mock('child_process', () => {
  const sym = Symbol.for('nodejs.util.promisify.custom')
  const fn = Object.assign(vi.fn(), { [sym]: execFileAsyncMock })
  return { execFile: fn }
})

vi.mock('fs', () => ({
  existsSync: vi.fn(),
}))

import { POST } from './route'
import { existsSync } from 'fs'

function makeRequest(body: unknown): NextRequest {
  return new NextRequest(new URL('http://localhost:4000/api/diff'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function mockGit(responses: Record<string, string>) {
  execFileAsyncMock.mockImplementation(async (_cmd: string, args: string[]) => {
    const key = args.join(' ')
    const match = Object.entries(responses).find(([k]) => key.includes(k))
    return { stdout: match?.[1] ?? '', stderr: '' }
  })
}

describe('Diff API route', () => {
  beforeEach(() => {
    vi.mocked(existsSync).mockReturnValue(true)
    mockGit({})
  })

  it('returns 400 on invalid body', async () => {
    const res = await POST(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('returns 400 on relative path', async () => {
    const res = await POST(makeRequest({ repoPath: './relative' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when .git does not exist', async () => {
    vi.mocked(existsSync).mockReturnValue(false)
    const res = await POST(makeRequest({ repoPath: '/home/user/repo' }))
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Not a git repo')
  })

  it('returns unstaged diff by default', async () => {
    mockGit({
      'diff --stat': '2 files changed',
      'diff': '+new line\n-old line',
      'status --porcelain': ' M file.ts',
    })
    const res = await POST(makeRequest({ repoPath: '/home/user/repo' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.diff).toContain('+new line')
    expect(data.summary).toBe('2 files changed')
  })

  it('returns staged diff', async () => {
    mockGit({
      'diff --cached --stat': '1 file changed',
      'diff --cached': '+staged line',
      'status --porcelain': 'M  file.ts',
    })
    const res = await POST(makeRequest({ repoPath: '/home/user/repo', mode: 'staged' }))
    const data = await res.json()
    expect(data.diff).toContain('+staged line')
  })

  it('returns last-commit diff', async () => {
    mockGit({
      'diff HEAD~1 --stat': '3 files changed',
      'diff HEAD~1': '+committed',
      'status --porcelain': '',
    })
    const res = await POST(makeRequest({ repoPath: '/home/user/repo', mode: 'last-commit' }))
    const data = await res.json()
    expect(data.diff).toContain('+committed')
  })

  it('handles unpushed with no upstream gracefully', async () => {
    execFileAsyncMock.mockImplementation(async (_cmd: string, args: string[]) => {
      const key = args.join(' ')
      if (key.includes('@{u}')) throw new Error('no upstream')
      return { stdout: '', stderr: '' }
    })
    const res = await POST(makeRequest({ repoPath: '/home/user/repo', mode: 'unpushed' }))
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.summary).toBe('No upstream branch set')
  })

  it('truncates diff at 50k chars', async () => {
    const bigDiff = 'x'.repeat(60000)
    mockGit({ 'diff --stat': '', 'diff': bigDiff, 'status --porcelain': '' })
    const res = await POST(makeRequest({ repoPath: '/home/user/repo' }))
    const data = await res.json()
    expect(data.diff.length).toBe(50000)
    expect(data.truncated).toBe(true)
  })

  it('caps file list at 200', async () => {
    const fileLines = Array.from({ length: 250 }, (_, i) => ` M file${i}.ts`).join('\n')
    mockGit({ 'diff --stat': '', 'diff': '+x', 'status --porcelain': fileLines })
    const res = await POST(makeRequest({ repoPath: '/home/user/repo' }))
    const data = await res.json()
    expect(data.files.length).toBe(200)
    expect(data.filesTruncated).toBe(true)
  })

  it('returns 500 on git command failure', async () => {
    execFileAsyncMock.mockRejectedValue(new Error('git crashed'))
    const res = await POST(makeRequest({ repoPath: '/home/user/repo' }))
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('git crashed')
  })
})
