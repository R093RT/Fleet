import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { z } from 'zod'

const GitStatusSchema = z.object({ paths: z.array(z.string()) })

function getGitInfo(repoPath: string) {
  if (!existsSync(path.join(repoPath, '.git'))) {
    return null
  }

  try {
    const opts = { cwd: repoPath, encoding: 'utf-8' as const, timeout: 5000 }

    const branch = execSync('git branch --show-current', opts).trim()

    // Uncommitted changes count
    const status = execSync('git status --porcelain', opts).trim()
    const uncommitted = status ? status.split('\n').length : 0

    // Unpushed commits
    let unpushed = 0
    try {
      const ahead = execSync(`git rev-list --count @{u}..HEAD`, opts).trim()
      unpushed = parseInt(ahead) || 0
    } catch {
      // No upstream set
      unpushed = 0
    }

    // Last commit
    let lastCommit = ''
    let lastCommitTime = ''
    try {
      lastCommit = execSync('git log -1 --pretty=format:%s', opts).trim()
      lastCommitTime = execSync('git log -1 --pretty=format:%ci', opts).trim()
    } catch {
      // Empty repo
    }

    return { branch, uncommitted, unpushed, lastCommit, lastCommitTime }
  } catch (e) {
    console.error(`Git error for ${repoPath}:`, e)
    return null
  }
}

export async function POST(req: NextRequest) {
  const parsed = GitStatusSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }

  const results: Record<string, ReturnType<typeof getGitInfo>> = {}
  for (const p of parsed.data.paths) {
    results[p] = getGitInfo(p)
  }

  return NextResponse.json(results)
}
