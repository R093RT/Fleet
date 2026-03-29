import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { existsSync } from 'fs'
import path from 'path'
import { readNotepad, writeNotepad, appendToWorkingMemory, deleteNotepad } from './notepad'

// Notepad uses process.cwd()/.fleet/notepads/ which is fine for tests
const NOTEPADS_DIR = path.join(process.cwd(), '.fleet', 'notepads')
const TEST_AGENT = 'test-notepad-agent'

beforeEach(() => {
  deleteNotepad(TEST_AGENT)
})

afterEach(() => {
  deleteNotepad(TEST_AGENT)
})

describe('readNotepad', () => {
  it('returns empty string for non-existent notepad', () => {
    expect(readNotepad('no-such-agent')).toBe('')
  })

  it('returns content after write', async () => {
    await writeNotepad(TEST_AGENT, '# Test\nHello world')
    expect(readNotepad(TEST_AGENT)).toBe('# Test\nHello world')
  })
})

describe('writeNotepad', () => {
  it('creates the notepad file', async () => {
    await writeNotepad(TEST_AGENT, 'content')
    expect(existsSync(path.join(NOTEPADS_DIR, `${TEST_AGENT}.md`))).toBe(true)
  })

  it('overwrites existing content', async () => {
    await writeNotepad(TEST_AGENT, 'first')
    await writeNotepad(TEST_AGENT, 'second')
    expect(readNotepad(TEST_AGENT)).toBe('second')
  })
})

describe('appendToWorkingMemory', () => {
  it('creates Working Memory section if not present', async () => {
    await appendToWorkingMemory(TEST_AGENT, 'first entry')
    const content = readNotepad(TEST_AGENT)
    expect(content).toContain('## Working Memory')
    expect(content).toContain('first entry')
  })

  it('appends to existing Working Memory section', async () => {
    await writeNotepad(TEST_AGENT, '## Priority Context\nImportant\n\n## Working Memory\n')
    await appendToWorkingMemory(TEST_AGENT, 'new learning')
    const content = readNotepad(TEST_AGENT)
    expect(content).toContain('## Priority Context')
    expect(content).toContain('new learning')
  })

  it('includes timestamp in entries', async () => {
    await appendToWorkingMemory(TEST_AGENT, 'timestamped')
    const content = readNotepad(TEST_AGENT)
    // Timestamp format: ### YYYY-MM-DD HH:MM:SS
    expect(content).toMatch(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)
  })

  it('prunes oldest entries when exceeding max (50)', async () => {
    for (let i = 0; i < 55; i++) {
      await appendToWorkingMemory(TEST_AGENT, `entry-${i}`)
    }
    const content = readNotepad(TEST_AGENT)
    const headingCount = (content.match(/### \d{4}/g) || []).length
    expect(headingCount).toBe(50)
    // Newest entry should be present (entry-54), oldest pruned (entry-0 through entry-4)
    expect(content).toContain('entry-54')
    expect(content).not.toContain('entry-0\n')
  })
})

describe('deleteNotepad', () => {
  it('removes the notepad file', async () => {
    await writeNotepad(TEST_AGENT, 'to delete')
    deleteNotepad(TEST_AGENT)
    expect(readNotepad(TEST_AGENT)).toBe('')
  })

  it('does not throw for non-existent notepad', () => {
    expect(() => deleteNotepad('no-such-agent')).not.toThrow()
  })
})
