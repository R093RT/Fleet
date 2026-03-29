import { describe, it, expect } from 'vitest'
import { modelCliArgs } from './tools'

describe('modelCliArgs', () => {
  it('returns empty array for default', () => {
    expect(modelCliArgs('default')).toEqual([])
  })

  it('returns empty array for undefined', () => {
    expect(modelCliArgs(undefined)).toEqual([])
  })

  it('returns --model claude-sonnet-4-5 for sonnet', () => {
    expect(modelCliArgs('sonnet')).toEqual(['--model', 'claude-sonnet-4-5'])
  })

  it('returns --model claude-haiku-4-5 for haiku', () => {
    expect(modelCliArgs('haiku')).toEqual(['--model', 'claude-haiku-4-5'])
  })

  it('returns --model claude-opus-4-5 for opus', () => {
    expect(modelCliArgs('opus')).toEqual(['--model', 'claude-opus-4-5'])
  })
})
