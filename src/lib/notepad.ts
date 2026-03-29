import { existsSync, mkdirSync, readFileSync, unlinkSync } from 'fs'
import path from 'path'
import { atomicWriteFileSync } from './atomic-write'
import { withFileLock } from './file-lock'

const NOTEPADS_DIR = path.join(process.cwd(), '.fleet', 'notepads')
const MAX_WORKING_MEMORY_ENTRIES = 50
/** Max bytes to inject into a prompt (100KB). Full content is still readable via readNotepad(). */
export const MAX_NOTEPAD_INJECTION_BYTES = 100_000

function ensureDir() {
  if (!existsSync(NOTEPADS_DIR)) mkdirSync(NOTEPADS_DIR, { recursive: true })
}

function notepadPath(agentId: string): string {
  return path.join(NOTEPADS_DIR, `${agentId}.md`)
}

function lockPath(agentId: string): string {
  return path.join(NOTEPADS_DIR, `${agentId}.lock`)
}

export function readNotepad(agentId: string): string {
  ensureDir()
  const p = notepadPath(agentId)
  if (!existsSync(p)) return ''
  try {
    return readFileSync(p, 'utf-8')
  } catch {
    return ''
  }
}

export async function writeNotepad(agentId: string, content: string): Promise<void> {
  ensureDir()
  await withFileLock(lockPath(agentId), () => {
    atomicWriteFileSync(notepadPath(agentId), content)
  })
}

export async function appendToWorkingMemory(agentId: string, entry: string): Promise<void> {
  ensureDir()
  await withFileLock(lockPath(agentId), () => {
    const existing = readNotepad(agentId)
    const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const newEntry = `\n### ${timestamp}\n${entry}\n`

    let updated: string
    if (existing.includes('## Working Memory')) {
      const idx = existing.indexOf('## Working Memory')
      const afterHeading = existing.indexOf('\n', idx)
      if (afterHeading !== -1) {
        updated = existing.slice(0, afterHeading + 1) + newEntry + existing.slice(afterHeading + 1)
      } else {
        updated = existing + newEntry
      }
    } else {
      updated = existing + (existing ? '\n' : '') + '## Working Memory\n' + newEntry
    }

    // Prune oldest entries if over limit (newest are at top of section)
    updated = pruneWorkingMemory(updated)
    atomicWriteFileSync(notepadPath(agentId), updated)
  })
}

function pruneWorkingMemory(content: string): string {
  const wmIdx = content.indexOf('## Working Memory')
  if (wmIdx === -1) return content

  const before = content.slice(0, wmIdx)
  const wmSection = content.slice(wmIdx)

  // Split on ### headings (each entry starts with \n### )
  const entryPattern = /\n### /g
  const matches: number[] = []
  let match: RegExpExecArray | null
  while ((match = entryPattern.exec(wmSection)) !== null) {
    matches.push(match.index)
  }

  if (matches.length <= MAX_WORKING_MEMORY_ENTRIES) return content

  // Keep only the first MAX entries (newest at top)
  const cutoffIdx = matches[MAX_WORKING_MEMORY_ENTRIES]!
  return before + wmSection.slice(0, cutoffIdx) + '\n'
}

export function deleteNotepad(agentId: string): void {
  try {
    const p = notepadPath(agentId)
    if (existsSync(p)) unlinkSync(p)
  } catch {
    /* ignore */
  }
  try {
    const lp = lockPath(agentId)
    if (existsSync(lp)) unlinkSync(lp)
  } catch {
    /* ignore */
  }
}
