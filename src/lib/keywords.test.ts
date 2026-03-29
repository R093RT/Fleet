import { describe, it, expect } from 'vitest'
import { detectKeywords, applyKeywords } from './keywords'

describe('detectKeywords', () => {
  it('detects "review" keyword', () => {
    const matches = detectKeywords('please review this PR')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.keyword).toBe('review')
  })

  it('detects "ship" keyword', () => {
    const matches = detectKeywords('ship this feature')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.keyword).toBe('ship')
  })

  it('detects "explore" keyword', () => {
    const matches = detectKeywords('explore the codebase')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.keyword).toBe('explore')
  })

  it('detects "plan" keyword', () => {
    const matches = detectKeywords('plan the implementation')
    expect(matches).toHaveLength(1)
    expect(matches[0]?.keyword).toBe('plan')
  })

  it('detects multiple keywords', () => {
    const matches = detectKeywords('review and plan this feature')
    expect(matches).toHaveLength(2)
    expect(matches.map((m) => m.keyword)).toContain('review')
    expect(matches.map((m) => m.keyword)).toContain('plan')
  })

  it('ignores keywords inside code blocks', () => {
    const matches = detectKeywords('fix this:\n```\nfunction review() {}\n```')
    expect(matches).toHaveLength(0)
  })

  it('ignores keywords inside inline code', () => {
    const matches = detectKeywords('the `review` function is broken')
    expect(matches).toHaveLength(0)
  })

  it('skips informational queries', () => {
    expect(detectKeywords('what is review?')).toHaveLength(0)
    expect(detectKeywords('how does ship work?')).toHaveLength(0)
    expect(detectKeywords('explain the plan mode')).toHaveLength(0)
  })

  it('returns empty for prompts with no keywords', () => {
    expect(detectKeywords('fix the bug in auth.ts')).toHaveLength(0)
  })

  it('matches keyword as word boundary only', () => {
    expect(detectKeywords('preview this')).toHaveLength(0) // "review" inside "preview"
    expect(detectKeywords('worship the code')).toHaveLength(0) // "ship" inside "worship"
  })
})

describe('applyKeywords', () => {
  it('prepends prompt prefix', () => {
    const matches = detectKeywords('review this code')
    const result = applyKeywords('review this code', matches)
    expect(result.modifiedPrompt).toContain('[MODE: REVIEW]')
    expect(result.modifiedPrompt).toContain('review this code')
  })

  it('collects agent updates', () => {
    const matches = detectKeywords('ship this feature')
    const result = applyKeywords('ship this feature', matches)
    expect(result.agentUpdates).toEqual({ autoIterate: true })
  })

  it('merges updates from multiple keywords', () => {
    const matches = detectKeywords('review and ship')
    const result = applyKeywords('review and ship', matches)
    expect(result.agentUpdates).toHaveProperty('status', 'reviewing')
    expect(result.agentUpdates).toHaveProperty('autoIterate', true)
  })

  it('returns unmodified prompt when no matches', () => {
    const result = applyKeywords('fix the bug', [])
    expect(result.modifiedPrompt).toBe('fix the bug')
    expect(result.agentUpdates).toEqual({})
  })
})
