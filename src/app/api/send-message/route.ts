import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { z } from 'zod'
import { DEFAULT_ALLOWED_TOOLS } from '@/lib/tools'

const SendMessageSchema = z.object({
  repoPath: z.string(),
  sessionId: z.string(),
  prompt: z.string(),
  allowedTools: z.array(z.string()).optional(),
})

export async function POST(req: NextRequest) {
  const parsed = SendMessageSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { repoPath, sessionId, prompt, allowedTools } = parsed.data

  const tools = allowedTools ?? DEFAULT_ALLOWED_TOOLS

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
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    const stderr = e != null && typeof e === 'object' && 'stderr' in e ? String((e as { stderr: unknown }).stderr) : ''
    return NextResponse.json({ success: false, error: msg, stderr }, { status: 500 })
  }
}
