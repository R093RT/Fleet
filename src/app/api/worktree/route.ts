import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync, mkdirSync, rmSync } from 'fs'
import path from 'path'
import { z } from 'zod'

const WorktreeCreateSchema = z.object({ agentId: z.string(), repoPath: z.string() })
const WorktreeDeleteSchema = z.object({ worktreePath: z.string(), repoPath: z.string() })

function isGitRepo(repoPath: string): boolean {
  // Works for both normal repos (.git dir) and worktrees (.git file)
  return existsSync(repoPath) && existsSync(path.join(repoPath, '.git'))
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

  const opts = { cwd: repoPath, encoding: 'utf-8' as const }

  try {
    // Try creating a new branch + worktree from HEAD
    execSync(`git worktree add -b "${branchName}" "${worktreePath}" HEAD`, opts)
    return NextResponse.json({ worktreePath, branchName })
  } catch {
    // Branch may already exist (e.g. from previous session) — add worktree to existing branch
    try {
      execSync(`git worktree add "${worktreePath}" "${branchName}"`, opts)
      return NextResponse.json({ worktreePath, branchName })
    } catch (e: unknown) {
      return NextResponse.json({ error: e instanceof Error ? e.message : String(e), fallback: true })
    }
  }
}

// DELETE: remove worktree when agent is removed
export async function DELETE(req: NextRequest) {
  const parsed = WorktreeDeleteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { worktreePath, repoPath } = parsed.data

  // Ask git to deregister the worktree (best-effort)
  try {
    if (isGitRepo(repoPath)) {
      execSync(`git worktree remove "${worktreePath}" --force`, { cwd: repoPath, encoding: 'utf-8' })
    }
  } catch {}

  // Remove directory regardless
  try {
    if (existsSync(worktreePath)) {
      rmSync(worktreePath, { recursive: true, force: true })
    }
  } catch {}

  return NextResponse.json({ success: true })
}
