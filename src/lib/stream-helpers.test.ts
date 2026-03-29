import { describe, it, expect } from 'vitest'
import { checkBudgetGates, handleResultMessage } from './stream-helpers'

describe('checkBudgetGates', () => {
  it('returns not blocked when no caps set', () => {
    const result = checkBudgetGates(null, 0, null, {})
    expect(result.blocked).toBe(false)
  })

  it('blocks when agent budget cap exceeded', () => {
    const result = checkBudgetGates(5.0, 5.01, null, {})
    expect(result.blocked).toBe(true)
    expect(result.message).toContain('budget cap')
  })

  it('blocks when daily fleet cap exceeded', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = checkBudgetGates(null, 0, 10.0, { [today]: 10.5 })
    expect(result.blocked).toBe(true)
    expect(result.message).toContain('daily fleet budget')
  })

  it('allows when under both caps', () => {
    const today = new Date().toISOString().slice(0, 10)
    const result = checkBudgetGates(10.0, 3.0, 20.0, { [today]: 5.0 })
    expect(result.blocked).toBe(false)
  })
})

describe('handleResultMessage', () => {
  const base = {
    finalText: 'Done!',
    msg: { cost: 0.05, inputTokens: 1000, outputTokens: 500 },
    prevCost: 0, prevTurns: 0, prevTokens: 0,
    budgetCap: null, autoIterate: false,
    iterateThreshold: 75, iterateMaxRounds: 3,
    iterState: null, agentName: 'TestAgent',
  }

  it('accumulates stats correctly', () => {
    const r = handleResultMessage(base)
    expect(r.newCost).toBe(0.05)
    expect(r.statsUpdate.sessionCost).toBe(0.05)
    expect(r.statsUpdate.sessionTurns).toBe(1)
    expect(r.statsUpdate.sessionTokens).toBe(1500)
  })

  it('sends notification when not auto-iterating', () => {
    const r = handleResultMessage(base)
    expect(r.notification).toBeDefined()
    expect(r.notification!.title).toBe('TestAgent finished')
  })

  it('detects budget exceeded', () => {
    const r = handleResultMessage({ ...base, budgetCap: 0.01 })
    expect(r.budgetExceeded).toBe(true)
    expect(r.budgetMessage).toContain('Budget cap')
  })

  it('starts rating on first auto-iterate completion', () => {
    const r = handleResultMessage({ ...base, autoIterate: true })
    expect(r.nextIterState).toEqual({ mode: 'rating', round: 1 })
    expect(r.pendingPrompt).toContain('Rate your work')
  })

  it('improves when score below threshold', () => {
    const r = handleResultMessage({
      ...base, autoIterate: true,
      finalText: 'Score: 60/100', iterState: { mode: 'rating', round: 1 },
    })
    expect(r.score).toBe(60)
    expect(r.nextIterState).toEqual({ mode: 'improving', round: 2 })
    expect(r.pendingPrompt).toContain('Improve')
  })

  it('finishes when score meets threshold', () => {
    const r = handleResultMessage({
      ...base, autoIterate: true,
      finalText: 'Score: 90/100', iterState: { mode: 'rating', round: 1 },
    })
    expect(r.score).toBe(90)
    expect(r.nextIterState).toBeNull()
    expect(r.iterMessage).toContain('done')
    expect(r.notification).toBeDefined()
  })

  it('re-rates after improving', () => {
    const r = handleResultMessage({
      ...base, autoIterate: true,
      iterState: { mode: 'improving', round: 2 },
    })
    expect(r.nextIterState).toEqual({ mode: 'rating', round: 2 })
    expect(r.pendingPrompt).toContain('Rate your updated work')
  })
})
