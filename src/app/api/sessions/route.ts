import { NextRequest, NextResponse } from 'next/server'
import { existsSync, readdirSync, readFileSync, rmSync } from 'fs'
import path from 'path'
import { z } from 'zod'
import { SafeId } from '@/lib/validate'

const sessionsDir = () => path.join(process.cwd(), '.fleet', 'sessions')

export async function GET() {
  const dir = sessionsDir()
  if (!existsSync(dir)) {
    return NextResponse.json({ sessions: [] })
  }

  try {
    const files = readdirSync(dir).filter(f => f.endsWith('.json'))
    const sessions = files.flatMap(f => {
      try {
        return [JSON.parse(readFileSync(path.join(dir, f), 'utf-8'))]
      } catch {
        return []
      }
    })
    return NextResponse.json({ sessions })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

const DeleteSchema = z.object({ agentId: SafeId })

export async function DELETE(req: NextRequest) {
  const parsed = DeleteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId } = parsed.data

  try {
    const filePath = path.join(sessionsDir(), `${agentId}.json`)
    if (existsSync(filePath)) {
      rmSync(filePath)
    }
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
