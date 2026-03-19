import { NextRequest } from 'next/server'
import { watch, existsSync } from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const repoPath = req.nextUrl.searchParams.get('path')

  if (!repoPath || !path.isAbsolute(repoPath) || !existsSync(repoPath)) {
    return new Response('Invalid path', { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      let debounce: ReturnType<typeof setTimeout> | null = null

      const watcher = watch(repoPath, { recursive: true }, (event, filename) => {
        // Skip node_modules, .git, and other noise
        if (!filename) return
        const skip = ['node_modules', '.git', '.next', 'dist', '__pycache__']
        if (skip.some(s => filename.includes(s))) return

        // Debounce to avoid flooding
        if (debounce) clearTimeout(debounce)
        debounce = setTimeout(() => {
          const data = JSON.stringify({ event, filename, timestamp: Date.now() })
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }, 500)
      })

      // Keep alive
      const keepAlive = setInterval(() => {
        controller.enqueue(encoder.encode(': keepalive\n\n'))
      }, 15000)

      // Cleanup on close
      req.signal.addEventListener('abort', () => {
        watcher.close()
        clearInterval(keepAlive)
        if (debounce) clearTimeout(debounce)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
