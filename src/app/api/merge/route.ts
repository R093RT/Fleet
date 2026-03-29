import { NextRequest, NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { existsSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { AbsolutePath } from '@/lib/validate'

const execFileAsync = promisify(execFile)

const BranchName = z.string().min(1).max(256).regex(/^[a-zA-Z0-9_./-]+$/, 'Invalid branch name')

const MergeSchema = z.object({
  repoPath: AbsolutePath,
  sourceBranch: BranchName,
  targetBranch: BranchName.optional(),
  mode: z.enum(['merge', 'dry-run']),
})

async function git(args: string[], cwd: string): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, encoding: 'utf-8', timeout: 30000 })
  return stdout
}

export async function POST(req: NextRequest) {
  const parsed = MergeSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { repoPath, sourceBranch, targetBranch, mode } = parsed.data

  if (!existsSync(path.join(repoPath, '.git'))) {
    return NextResponse.json({ error: 'Not a git repo' }, { status: 400 })
  }

  try {
    // Make sure we're on the right target branch
    const target = targetBranch ?? 'main'
    const currentBranch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath)).trim()

    if (currentBranch !== target) {
      await git(['checkout', target], repoPath)
    }

    if (mode === 'dry-run') {
      // Attempt merge without committing, then abort
      try {
        await git(['merge', '--no-commit', '--no-ff', sourceBranch], repoPath)
        const diff = await git(['diff', '--cached', '--stat'], repoPath)
        // Abort the merge
        await git(['merge', '--abort'], repoPath)
        return NextResponse.json({ success: true, conflicts: false, diff: diff.trim() })
      } catch (e: unknown) {
        // If merge fails, there are conflicts
        const msg = e instanceof Error ? e.message : String(e)
        try { await git(['merge', '--abort'], repoPath) } catch { /* already aborted or clean */ }
        return NextResponse.json({ success: true, conflicts: true, message: msg })
      }
    }

    // Actual merge
    const result = await git(['merge', '--no-ff', '-m', `Merge ${sourceBranch} into ${target}`], repoPath)
    return NextResponse.json({ success: true, result: result.trim() })
  } catch (e: unknown) {
    try { await git(['merge', '--abort'], repoPath) } catch { /* safe to ignore */ }
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
