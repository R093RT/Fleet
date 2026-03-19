import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'

export async function POST(req: NextRequest) {
  const { repoPath, sessionId, prompt, allowedTools } = await req.json() as {
    repoPath: string
    sessionId: string
    prompt: string
    allowedTools?: string[]
  }

  const tools = allowedTools || [
    'Read', 'Write', 'Edit',
    'Bash(npm run *)', 'Bash(npx *)', 'Bash(node *)',
    'Bash(git add *)', 'Bash(git commit *)', 'Bash(git status)',
    'Bash(git diff *)', 'Bash(git log *)', 'Bash(git branch *)',
    'Bash(cat *)', 'Bash(ls *)', 'Bash(mkdir *)', 'Bash(grep *)',
    'Bash(find *)', 'Bash(echo *)',
  ]

  try {
    // Resume existing session with --session-id and --resume
    const toolArgs = tools.map(t => `--allowedTools "${t}"`).join(' ')
    const cmd = `claude -p "${prompt.replace(/"/g, '\\"')}" --session-id ${sessionId} --resume --output-format json ${toolArgs}`

    const result = execSync(cmd, {
      cwd: repoPath,
      encoding: 'utf-8',
      timeout: 300000, // 5 min timeout
      env: { ...process.env },
    })

    let parsed
    try {
      parsed = JSON.parse(result)
    } catch {
      parsed = { result: result.trim() }
    }

    return NextResponse.json({
      success: true,
      response: parsed.result || result.trim(),
      cost: parsed.cost || null,
      sessionId: parsed.session_id || sessionId,
    })
  } catch (e: any) {
    return NextResponse.json({
      success: false,
      error: e.message,
      stderr: e.stderr?.toString() || '',
    }, { status: 500 })
  }
}
