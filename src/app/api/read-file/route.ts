import { NextRequest, NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { z } from 'zod'
import { AbsolutePath } from '@/lib/validate'

export const dynamic = 'force-dynamic'

const QuerySchema = z.object({
  path: AbsolutePath,
})

export async function GET(req: NextRequest) {
  const pathParam = req.nextUrl.searchParams.get('path')
  const parsed = QuerySchema.safeParse({ path: pathParam })
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid path', details: parsed.error.flatten() }, { status: 400 })
  }

  const filePath = parsed.data.path

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found', exists: false }, { status: 404 })
  }

  try {
    const content = readFileSync(filePath, 'utf-8')
    return NextResponse.json({ content, exists: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), exists: false }, { status: 500 })
  }
}
