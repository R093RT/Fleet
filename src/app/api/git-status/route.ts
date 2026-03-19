import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'

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
  const { paths } = await req.json() as { paths: string[] }

  const results: Record<string, ReturnType<typeof getGitInfo>> = {}
  for (const p of paths) {
    results[p] = getGitInfo(p)
  }

  return NextResponse.json(results)
}
