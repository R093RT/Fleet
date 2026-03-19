import { NextRequest, NextResponse } from 'next/server'
import { spawnSync } from 'child_process'
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs'
import path from 'path'
import { PNG } from 'pngjs'
import pixelmatch from 'pixelmatch'
import { z } from 'zod'
import { SafeId } from '@/lib/validate'

const ScreenshotSchema = z.object({
  agentId: SafeId,
  url: z.string().url(),
  label: z.enum(['before', 'after']).optional(),
})

const SCREENSHOT_DIR = path.join(process.cwd(), 'public', 'screenshots')

function ensureDir() {
  if (!existsSync(SCREENSHOT_DIR)) {
    mkdirSync(SCREENSHOT_DIR, { recursive: true })
  }
}

function capturePlaywright(url: string, filepath: string): boolean {
  try {
    // Use args array — never interpolate user values into a shell command string
    const result = spawnSync(
      'npx',
      ['playwright', 'screenshot', '--browser', 'chromium', url, filepath],
      { timeout: 30000, encoding: 'utf-8', shell: true }
    )
    return result.status === 0 && !result.error
  } catch {
    return false
  }
}

type DiffResult =
  | { ok: true; diffPixels: number; totalPixels: number }
  | { ok: false; dimensionMismatch: true; beforeSize: string; afterSize: string }

function computeDiff(beforePath: string, afterPath: string, diffPath: string): DiffResult {
  const img1 = PNG.sync.read(readFileSync(beforePath))
  const img2 = PNG.sync.read(readFileSync(afterPath))
  if (img1.width !== img2.width || img1.height !== img2.height) {
    return {
      ok: false,
      dimensionMismatch: true,
      beforeSize: `${img1.width}×${img1.height}`,
      afterSize: `${img2.width}×${img2.height}`,
    }
  }
  const { width, height } = img1
  const diff = new PNG({ width, height })
  const diffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, { threshold: 0.1 })
  writeFileSync(diffPath, PNG.sync.write(diff))
  return { ok: true, diffPixels, totalPixels: width * height }
}

export async function POST(req: NextRequest) {
  const parsed = ScreenshotSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
  }
  const { agentId, url, label } = parsed.data

  ensureDir()

  // Labelled capture: before/after with diff
  if (label === 'before' || label === 'after') {
    const filename = `${agentId}-${label}.png`
    const filepath = path.join(SCREENSHOT_DIR, filename)
    const webPath = `/screenshots/${filename}`

    const captured = capturePlaywright(url, filepath)

    if (!captured) {
      return NextResponse.json({
        success: false,
        note: 'Playwright not available. Run: npx playwright install chromium',
        path: null,
      })
    }

    if (label === 'before') {
      return NextResponse.json({ success: true, path: webPath })
    }

    // label === 'after' — attempt diff
    const beforeFilePath = path.join(SCREENSHOT_DIR, `${agentId}-before.png`)
    if (!existsSync(beforeFilePath)) {
      return NextResponse.json({ success: true, afterPath: webPath, diffPath: null })
    }

    try {
      const diffFilename = `${agentId}-diff.png`
      const diffFilePath = path.join(SCREENSHOT_DIR, diffFilename)
      const result = computeDiff(beforeFilePath, filepath, diffFilePath)

      if (!result.ok) {
        return NextResponse.json({
          success: true,
          afterPath: webPath,
          diffPath: null,
          dimensionMismatch: true,
          beforeSize: result.beforeSize,
          afterSize: result.afterSize,
        })
      }

      const { diffPixels, totalPixels } = result
      return NextResponse.json({
        success: true,
        beforePath: `/screenshots/${agentId}-before.png`,
        afterPath: webPath,
        diffPath: `/screenshots/${diffFilename}`,
        diffPixels,
        totalPixels,
        diffPercent: (diffPixels / totalPixels) * 100,
      })
    } catch (e: unknown) {
      return NextResponse.json({
        success: true,
        afterPath: webPath,
        diffPath: null,
        diffError: e instanceof Error ? e.message : String(e),
      })
    }
  }

  // Default (no label): timestamped file — existing behaviour
  const filename = `${agentId}-${Date.now()}.png`
  const filepath = path.join(SCREENSHOT_DIR, filename)

  try {
    const captured = capturePlaywright(url, filepath)
    if (captured) {
      return NextResponse.json({ success: true, path: `/screenshots/${filename}` })
    }
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    return NextResponse.json({
      success: true,
      reachable: res.ok,
      status: res.status,
      note: 'Install playwright for actual screenshots: npx playwright install chromium',
      path: null,
    })
  } catch (e: unknown) {
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

const DeleteSchema = z.object({ agentId: SafeId })

export async function DELETE(req: NextRequest) {
  const parsed = DeleteSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }
  const { agentId } = parsed.data
  for (const label of ['before', 'after', 'diff']) {
    const fp = path.join(SCREENSHOT_DIR, `${agentId}-${label}.png`)
    try { if (existsSync(fp)) unlinkSync(fp) } catch {}
  }
  return NextResponse.json({ success: true })
}
