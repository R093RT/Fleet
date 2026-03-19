import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, writeFileSync, existsSync } from 'fs'

const ROADMAP_PATH = process.env.ROADMAP_PATH || ''

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
  } catch (e: any) {
    return NextResponse.json({ content: '', exists: false, error: e.message })
  }
}

export async function PUT(req: NextRequest) {
  if (!ROADMAP_PATH) {
    return NextResponse.json({ success: false, error: 'ROADMAP_PATH not configured' }, { status: 400 })
  }
  const { content } = await req.json() as { content: string }
  try {
    writeFileSync(ROADMAP_PATH, content, 'utf-8')
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message }, { status: 500 })
  }
}
