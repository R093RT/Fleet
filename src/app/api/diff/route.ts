import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

export async function POST(req: NextRequest) {
  const { repoPath, mode } = await req.json() as {
    repoPath: string
    mode?: 'staged' | 'unstaged' | 'last-commit' | 'unpushed'
  }

  if (!existsSync(path.join(repoPath, '.git'))) {
    return NextResponse.json({ error: 'Not a git repo' }, { status: 400 })
  }

  const opts = { cwd: repoPath, encoding: 'utf-8' as const, timeout: 10000 }

  try {
    let diff = ''
    let summary = ''

    switch (mode || 'unstaged') {
      case 'staged':
        diff = execSync('git diff --cached', opts)
        summary = execSync('git diff --cached --stat', opts)
        break
      case 'unstaged':
        diff = execSync('git diff', opts)
        summary = execSync('git diff --stat', opts)
        break
      case 'last-commit':
        diff = execSync('git diff HEAD~1', opts)
        summary = execSync('git diff HEAD~1 --stat', opts)
        break
      case 'unpushed':
        try {
          diff = execSync('git diff @{u}..HEAD', opts)
          summary = execSync('git diff @{u}..HEAD --stat', opts)
        } catch {
          diff = ''
          summary = 'No upstream branch set'
        }
        break
    }

    // Get list of changed files
    let files: string[] = []
    try {
      const statusOut = execSync('git status --porcelain', opts)
      files = statusOut.split('\n').filter(Boolean).map(l => l.trim())
    } catch {}

    return NextResponse.json({
      diff: diff.slice(0, 50000), // Cap at 50k chars
      summary: summary.trim(),
      files,
      truncated: diff.length > 50000,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
