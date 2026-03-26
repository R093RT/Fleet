import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { z } from 'zod'

const ROADMAP_PATH = process.env.ROADMAP_PATH || ''

const RoadmapPutSchema = z.object({ content: z.string().max(1_000_000) })

export async function GET() {
  if (!ROADMAP_PATH) {
    return NextResponse.json({
      content: '# Roadmap\n\nNo roadmap file linked. Set `ROADMAP_PATH` in your `.env` file to point to a markdown file.',
      exists: false,
    })
  }
  try {
    if (!existsSync(ROADMAP_PATH)) {
      return NextResponse.json({ content: `# Roadmap\n\nFile not found: ${ROADMAP_PATH}`, exists: false })
    }
    const content = readFileSync(ROADMAP_PATH, 'utf-8')
    return NextResponse.json({ content, exists: true })
  } catch (e: unknown) {
    return NextResponse.json({ content: '', exists: false, error: e instanceof Error ? e.message : String(e) })
  }
}

export async function PUT(req: NextRequest) {
  if (!ROADMAP_PATH) {
    return NextResponse.json({ success: false, error: 'ROADMAP_PATH not configured' }, { status: 400 })
  }
  const parsed = RoadmapPutSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { content } = parsed.data
  try {
    writeFileSync(ROADMAP_PATH, content, 'utf-8')
    return NextResponse.json({ success: true })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
