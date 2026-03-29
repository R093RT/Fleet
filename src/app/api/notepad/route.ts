import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { SafeId } from '@/lib/validate'
import { readNotepad, writeNotepad, appendToWorkingMemory, deleteNotepad } from '@/lib/notepad'

const WriteSchema = z.object({
  agentId: SafeId,
  content: z.string().max(100_000),
})

const AppendSchema = z.object({
  agentId: SafeId,
  entry: z.string().min(1).max(50_000),
})

const DeleteSchema = z.object({
  agentId: SafeId,
})

// GET: read notepad content
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('agentId')
  const { data: agentId, success } = SafeId.safeParse(raw)
  if (!success) return NextResponse.json({ error: 'agentId required' }, { status: 400 })

  const content = readNotepad(agentId)
  return NextResponse.json({ content, exists: content.length > 0 })
}

// PUT: overwrite notepad content
export async function PUT(req: NextRequest) {
  const parsed = WriteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId, content } = parsed.data

  try {
    await writeNotepad(agentId, content)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// POST: append to working memory
export async function POST(req: NextRequest) {
  const parsed = AppendSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId, entry } = parsed.data

  try {
    await appendToWorkingMemory(agentId, entry)
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

// DELETE: remove notepad
export async function DELETE(req: NextRequest) {
  const parsed = DeleteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId } = parsed.data

  deleteNotepad(agentId)
  return NextResponse.json({ success: true })
}
