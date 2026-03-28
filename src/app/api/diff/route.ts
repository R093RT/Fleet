import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { AbsolutePath } from '@/lib/validate'

const execFileAsync = promisify(execFile)

const DiffSchema = z.object({
  repoPath: AbsolutePath,
  mode: z.enum(['staged', 'unstaged', 'last-commit', 'unpushed']).optional(),
})

const MAX_FILES = 200

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf-8', timeout: 10000 })
  return stdout
}

export async function POST(req: NextRequest) {
  const parsed = DiffSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { repoPath, mode } = parsed.data

  if (!existsSync(path.join(repoPath, '.git'))) {
    return NextResponse.json({ error: 'Not a git repo' }, { status: 400 })
  }

  try {
    let diff = ''
    let summary = ''

    switch (mode || 'unstaged') {
      case 'staged':
        diff = await git(['diff', '--cached'], repoPath)
        summary = await git(['diff', '--cached', '--stat'], repoPath)
        break
      case 'unstaged':
        diff = await git(['diff'], repoPath)
        summary = await git(['diff', '--stat'], repoPath)
        break
      case 'last-commit':
        diff = await git(['diff', 'HEAD~1'], repoPath)
        summary = await git(['diff', 'HEAD~1', '--stat'], repoPath)
        break
      case 'unpushed':
        try {
          diff = await git(['diff', '@{u}..HEAD'], repoPath)
          summary = await git(['diff', '@{u}..HEAD', '--stat'], repoPath)
        } catch (e: unknown) {
          // Expected when no upstream is configured — not a bug
          console.info('Unpushed diff unavailable:', e instanceof Error ? e.message : String(e))
          diff = ''
          summary = 'No upstream branch set'
        }
        break
    }

    // Get list of changed files (capped)
    let files: string[] = []
    let filesTruncated = false
    try {
      const statusOut = await git(['status', '--porcelain'], repoPath)
      const allFiles = statusOut.split('\n').filter(Boolean).map(l => l.trim())
      filesTruncated = allFiles.length > MAX_FILES
      files = allFiles.slice(0, MAX_FILES)
    } catch (e: unknown) {
      console.warn('git status failed:', e instanceof Error ? e.message : String(e))
    }

    return NextResponse.json({
      diff: diff.slice(0, 50000), // Cap at 50k chars
      summary: summary.trim(),
      files,
      truncated: diff.length > 50000,
      filesTruncated,
    })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
