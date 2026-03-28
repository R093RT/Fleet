import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'fs'
import path from 'path'
import { z } from 'zod'

const OBSIDIAN_VAULT = process.env.OBSIDIAN_VAULT || ''

const SaveNoteSchema = z.object({
  title: z.string().min(1).max(500),
  content: z.string().max(1_000_000),
  folder: z.string().max(200).regex(/^[a-zA-Z0-9_\-\/]*$/).optional().default(''),
})

// Key files to inject as context for agents
const CONTEXT_FILES = ['Vault_Map.md', 'Repository_Map.md']

/**
 * Recursively find a .md file by name (wikilink-style lookup).
 * Returns the absolute path if found, null otherwise.
 */
function findFile(vaultPath: string, name: string): string | null {
  const target = name.endsWith('.md') ? name : `${name}.md`
  try {
    const allFiles = readdirSync(vaultPath, { recursive: true, encoding: 'utf-8' }) as string[]
    const match = allFiles.find(f => path.basename(f) === target)
    return match ? path.join(vaultPath, match) : null
  } catch {
    return null
  }
}

/**
 * Convert a title to the vault's filename convention:
 * "my research topic" → "My_Research_Topic.md"
 */
function toFilename(title: string): string {
  let name = title.replace(/\s+/g, '_')
  // Title_Case each segment
  name = name
    .split('_')
    .map(w => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join('_')
  if (!name.endsWith('.md')) name += '.md'
  return name
}

/**
 * GET /api/vault
 *
 * Three modes:
 *   (no params)     → returns concatenated context files for prompt injection
 *   ?search=keyword → searches all .md files for keyword, returns matches
 *   ?note=Name      → reads a specific note by name (wikilink-style)
 */
export async function GET(req: NextRequest) {
  if (!OBSIDIAN_VAULT) {
    return NextResponse.json({ content: '', exists: false, error: 'OBSIDIAN_VAULT not configured' })
  }
  if (!existsSync(OBSIDIAN_VAULT)) {
    return NextResponse.json({ content: '', exists: false, error: `Vault not found: ${OBSIDIAN_VAULT}` })
  }

  const search = req.nextUrl.searchParams.get('search')
  const note = req.nextUrl.searchParams.get('note')

  // Mode: read a specific note
  if (note) {
    try {
      const filePath = findFile(OBSIDIAN_VAULT, note)
      if (!filePath || !existsSync(filePath)) {
        return NextResponse.json({ content: '', exists: false, name: note })
      }
      const content = readFileSync(filePath, 'utf-8')
      return NextResponse.json({ content, exists: true, name: note })
    } catch (e: unknown) {
      return NextResponse.json({ content: '', exists: false, error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Mode: search notes by keyword
  if (search) {
    try {
      const allFiles = (readdirSync(OBSIDIAN_VAULT, { recursive: true, encoding: 'utf-8' }) as string[])
        .filter(f => f.endsWith('.md') && !f.startsWith('.obsidian'))
      const term = search.toLowerCase()
      const MAX_FILE_SIZE = 1_048_576 // 1 MB — skip larger files to avoid OOM
      const results: { name: string; path: string; snippet: string }[] = []
      for (const f of allFiles) {
        const fullPath = path.join(OBSIDIAN_VAULT, f)
        try { if (statSync(fullPath).size > MAX_FILE_SIZE) continue } catch { continue }
        const content = readFileSync(fullPath, 'utf-8')
        if (content.toLowerCase().includes(term)) {
          const idx = content.toLowerCase().indexOf(term)
          const start = Math.max(0, idx - 50)
          const end = Math.min(content.length, idx + 150)
          results.push({
            name: path.basename(f, '.md'),
            path: f.replace(/\\/g, '/'),
            snippet: content.slice(start, end),
          })
        }
        if (results.length >= 20) break
      }
      return NextResponse.json({ results })
    } catch (e: unknown) {
      return NextResponse.json({ results: [], error: e instanceof Error ? e.message : String(e) })
    }
  }

  // Default: read context files for injection
  try {
    const parts: string[] = []
    for (const filename of CONTEXT_FILES) {
      const filePath = findFile(OBSIDIAN_VAULT, filename)
      if (filePath && existsSync(filePath)) {
        parts.push(readFileSync(filePath, 'utf-8'))
      }
    }
    const content = parts.join('\n\n---\n\n')
    return NextResponse.json({ content, exists: parts.length > 0, charCount: content.length })
  } catch (e: unknown) {
    return NextResponse.json({ content: '', exists: false, error: e instanceof Error ? e.message : String(e) })
  }
}

/**
 * POST /api/vault
 *
 * Save a new note to the vault.
 * Body: { title: string, content: string, folder?: string }
 *
 * The note is formatted with the vault's blockquote header convention.
 * If a file with the same name already exists, a timestamp suffix is added.
 */
export async function POST(req: NextRequest) {
  if (!OBSIDIAN_VAULT) {
    return NextResponse.json({ success: false, error: 'OBSIDIAN_VAULT not configured' }, { status: 400 })
  }

  const parsed = SaveNoteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { title, content, folder } = parsed.data

  try {
    const filename = toFilename(title)
    const dir = path.join(OBSIDIAN_VAULT, folder)
    if (!path.resolve(dir).startsWith(path.resolve(OBSIDIAN_VAULT))) {
      return NextResponse.json({ success: false, error: 'Invalid folder path' }, { status: 400 })
    }
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

    let finalFilename = filename
    let fullPath = path.join(dir, filename)

    // Avoid overwriting existing files — append timestamp suffix
    if (existsSync(fullPath)) {
      const stamp = Date.now()
      finalFilename = filename.replace('.md', `_${stamp}.md`)
      fullPath = path.join(dir, finalFilename)
    }

    const today = new Date().toISOString().slice(0, 10)
    const humanTitle = title.replace(/_/g, ' ')
    const formatted = `# ${humanTitle}\n\n> Purpose: Research output from Fleet agent\n> Last updated: ${today}\n\n---\n\n${content}\n`

    writeFileSync(fullPath, formatted, 'utf-8')

    return NextResponse.json({
      success: true,
      path: path.join(folder, finalFilename).replace(/\\/g, '/'),
      filename: finalFilename,
    })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
