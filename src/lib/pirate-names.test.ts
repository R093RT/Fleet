import { describe, it, expect } from 'vitest'
import {
  PIRATE_NAMES,
  PIRATE_COLORS,
  DOMAIN_TO_ROLE,
  assignPirateIdentities,
  type Workstream,
} from './pirate-names'

describe('PIRATE_NAMES', () => {
  it('has at least 20 entries', () => {
    expect(PIRATE_NAMES.length).toBeGreaterThanOrEqual(20)
  })

  it('each entry has a non-empty name and icon', () => {
    for (const p of PIRATE_NAMES) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.icon.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate names', () => {
    const names = PIRATE_NAMES.map(p => p.name)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('DOMAIN_TO_ROLE', () => {
  it('maps all expected domains', () => {
    const expected = ['frontend', 'backend', 'testing', 'devops', 'database', 'docs', 'security', 'performance', 'general']
    for (const domain of expected) {
      expect(DOMAIN_TO_ROLE[domain]).toBeDefined()
    }
  })
})

describe('PIRATE_COLORS', () => {
  it('has at least 10 colors', () => {
    expect(PIRATE_COLORS.length).toBeGreaterThanOrEqual(10)
  })

  it('all values are hex color strings', () => {
    for (const color of PIRATE_COLORS) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})

describe('assignPirateIdentities', () => {
  const makeWorkstream = (overrides: Partial<Workstream> = {}): Workstream => ({
    name: 'Test Workstream',
    description: 'Test description',
    tasks: ['task1', 'task2'],
    complexity: 3,
    dependencies: [],
    domain: 'frontend',
    ...overrides,
  })

  it('returns same number of assignments as input workstreams', () => {
    const workstreams = [makeWorkstream(), makeWorkstream({ name: 'WS2' })]
    const result = assignPirateIdentities(workstreams)
    expect(result).toHaveLength(2)
  })

  it('preserves workstream data in assignments', () => {
    const ws = makeWorkstream({ name: 'Auth', description: 'Build auth', tasks: ['login', 'signup'] })
    const [assignment] = assignPirateIdentities([ws])
    expect(assignment?.name).toBe('Auth')
    expect(assignment?.description).toBe('Build auth')
    expect(assignment?.tasks).toEqual(['login', 'signup'])
  })

  it('assigns pirate names from the PIRATE_NAMES pool', () => {
    const workstreams = [makeWorkstream(), makeWorkstream({ name: 'WS2' })]
    const result = assignPirateIdentities(workstreams)
    const allNames = PIRATE_NAMES.map(p => p.name)
    for (const r of result) {
      expect(allNames).toContain(r.pirateName)
    }
  })

  it('assigns matching icon for each pirate name', () => {
    const workstreams = [makeWorkstream()]
    const [result] = assignPirateIdentities(workstreams)
    const pirate = PIRATE_NAMES.find(p => p.name === result?.pirateName)
    expect(result?.pirateIcon).toBe(pirate?.icon)
  })

  it('maps domain to correct pirate role', () => {
    const ws = makeWorkstream({ domain: 'backend' })
    const [result] = assignPirateIdentities([ws])
    expect(result?.pirateRole).toBe('Bosun')
  })

  it('defaults unknown domains to Deckhand', () => {
    const ws = makeWorkstream({ domain: 'unknown-domain' })
    const [result] = assignPirateIdentities([ws])
    expect(result?.pirateRole).toBe('Deckhand')
  })

  it('assigns colors from PIRATE_COLORS', () => {
    const workstreams = Array.from({ length: 5 }, (_, i) => makeWorkstream({ name: `WS${i}` }))
    const result = assignPirateIdentities(workstreams)
    for (const r of result) {
      expect(PIRATE_COLORS).toContain(r.pirateColor)
    }
  })

  it('wraps around when more workstreams than names', () => {
    const workstreams = Array.from({ length: PIRATE_NAMES.length + 2 }, (_, i) =>
      makeWorkstream({ name: `WS${i}` })
    )
    const result = assignPirateIdentities(workstreams)
    expect(result).toHaveLength(PIRATE_NAMES.length + 2)
    // All should still have valid pirate names
    const allNames = PIRATE_NAMES.map(p => p.name)
    for (const r of result) {
      expect(allNames).toContain(r.pirateName)
    }
  })

  it('handles empty input', () => {
    const result = assignPirateIdentities([])
    expect(result).toEqual([])
  })
})
