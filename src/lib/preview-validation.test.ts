import { describe, it, expect } from 'vitest'
import { buildSafeLocalhostUrl } from './url-validation'

describe('buildSafeLocalhostUrl', () => {
  it('accepts valid localhost URL', () => {
    expect(buildSafeLocalhostUrl('3000', '/')).toBe('http://localhost:3000/')
  })

  it('accepts path with segments', () => {
    expect(buildSafeLocalhostUrl('3000', '/api/health')).toBe('http://localhost:3000/api/health')
  })

  it('accepts path with query string', () => {
    expect(buildSafeLocalhostUrl('3000', '/page?foo=bar')).toBe('http://localhost:3000/page?foo=bar')
  })

  it('accepts empty port (defaults to port 80)', () => {
    expect(buildSafeLocalhostUrl('', '/')).toBe('http://localhost/')
  })

  it('keeps double-slash paths safe under localhost', () => {
    // //evil.com becomes a path segment under localhost:3000, not a host override
    const result = buildSafeLocalhostUrl('3000', '//evil.com/path')
    expect(result).toContain('localhost:3000')
  })

  it('rejects javascript: protocol', () => {
    expect(buildSafeLocalhostUrl('3000', 'javascript:alert(1)//')).toBeNull()
  })

  it('rejects data: URL', () => {
    expect(buildSafeLocalhostUrl('', 'data:text/html,<h1>hi</h1>')).toBeNull()
  })

  it('rejects when hostname is overridden via @', () => {
    // http://localhost:3000@evil.com/ would set hostname to evil.com
    expect(buildSafeLocalhostUrl('3000@evil.com', '/')).toBeNull()
  })

  it('rejects invalid URL syntax', () => {
    expect(buildSafeLocalhostUrl('not-a-port', '/')).toBeNull()
  })
})
