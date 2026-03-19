import { NextRequest, NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync, mkdirSync } from 'fs'
import path from 'path'
import { z } from 'zod'

const ScreenshotSchema = z.object({ agentId: z.string(), url: z.string().url() })

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots')

export async function POST(req: NextRequest) {
  const parsed = ScreenshotSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId, url } = parsed.data

  // Ensure screenshot directory exists
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }

  const filename = `${agentId}-${Date.now()}.png`
  const filepath = path.join(SCREENSHOT_DIR, filename)

  try {
    // Try using Playwright if installed, otherwise fall back to a simple fetch check
    try {
      // This requires: npx playwright install chromium
      execSync(
        `npx playwright screenshot --browser chromium "${url}" "${filepath}"`,
        { timeout: 30000, encoding: 'utf-8' }
      )
      return NextResponse.json({ success: true, path: `/screenshots/${filename}` })
    } catch {
      // Fallback: just verify the URL is reachable
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      return NextResponse.json({
        success: true,
        reachable: res.ok,
        status: res.status,
        note: 'Install playwright for actual screenshots: npx playwright install chromium',
        path: null,
      })
    }
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
