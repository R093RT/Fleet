import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { SafeId, AbsolutePath } from '@/lib/validate'

const WorktreeCreateSchema = z.object({ agentId: SafeId, repoPath: AbsolutePath })
const WorktreeDeleteSchema = z.object({ worktreePath: AbsolutePath, repoPath: AbsolutePath })

function isGitRepo(repoPath: string): boolean {
  // Works for both normal repos (.git dir) and worktrees (.git file)
  return existsSync(repoPath) && existsSync(path.join(repoPath, '.git'))
}

/** Run a git command via args array (never shell-interpolated strings). */
function runGit(args: string[], cwd: string): { ok: boolean; stderr: string } {
  const r = spawnSync('git', args, { cwd, encoding: 'utf-8', timeout: 15000 })
  return { ok: r.status === 0 && !r.error, stderr: r.stderr ?? '' }
}

// POST: create an isolated worktree for an agent
export async function POST(req: NextRequest) {
  const parsed = WorktreeCreateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId, repoPath } = parsed.data

  if (!isGitRepo(repoPath)) {
    return NextResponse.json({ error: 'Not a git repository', fallback: true })
  }

  const worktreePath = path.join(process.cwd(), '.fleet', 'worktrees', agentId)
  const branchName = `fleet/${agentId}`

  // Idempotent: if worktree directory already exists, reuse it
  if (existsSync(worktreePath)) {
    return NextResponse.json({ worktreePath, branchName })
  }

  // Ensure parent directory exists
  mkdirSync(path.dirname(worktreePath), { recursive: true })

  // Try creating a new branch + worktree from HEAD
  const r1 = runGit(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'], repoPath)
  if (r1.ok) {
    return NextResponse.json({ worktreePath, branchName })
  }

  // Branch may already exist (e.g. from previous session) — add worktree to existing branch
  const r2 = runGit(['worktree', 'add', worktreePath, branchName], repoPath)
  if (r2.ok) {
    return NextResponse.json({ worktreePath, branchName })
  }

  return NextResponse.json({ error: r2.stderr || 'git worktree add failed', fallback: true })
}

// DELETE: remove worktree when agent is removed
export async function DELETE(req: NextRequest) {
  const parsed = WorktreeDeleteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { worktreePath, repoPath } = parsed.data

  // Ask git to deregister the worktree (best-effort)
  if (isGitRepo(repoPath)) {
    runGit(['worktree', 'remove', worktreePath, '--force'], repoPath)
  }

  // Remove directory regardless
  try {
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true })
    }
  } catch {}

  return NextResponse.json({ success: true })
}
