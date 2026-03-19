import { NextResponse } from 'next/server'
import { execSync } from 'child_process'
import { existsSync } from 'fs'

export interface DiscoveredProcess {
  pid: number
  cwd: string
  sessionId: string | null
  promptSnippet: string
}

function extractSessionId(cmdLine: string): string | null {
  const m = cmdLine.match(/--session-id\s+([^\s]+)/)
  return m?.[1] ?? null
}

function extractPromptSnippet(cmdLine: string): string {
  // Match -p "..." or -p '...' or -p value
  const quoted = cmdLine.match(/-p\s+"([^"]*)"/) ?? cmdLine.match(/-p\s+'([^']*)'/)
  if (quoted?.[1]) return quoted[1].slice(0, 80)
  const unquoted = cmdLine.match(/-p\s+(\S+)/)
  if (unquoted?.[1]) return unquoted[1].slice(0, 80)
  return ''
}

function discoverWindows(): DiscoveredProcess[] {
  try {
    const raw = execSync(
      'powershell -NoProfile -Command "Get-WmiObject Win32_Process | Where-Object { $_.CommandLine -like \'*claude*\' -and $_.CommandLine -like \'* -p *\' } | Select-Object ProcessId, CommandLine, WorkingDirectory | ConvertTo-Json -Depth 2"',
      { encoding: 'utf-8', timeout: 10000 }
    ).trim()

    if (!raw || raw === 'null') return []

    // PowerShell returns an object (not array) when there is only one result
    const parsed: unknown = JSON.parse(raw)
    const items = Array.isArray(parsed) ? parsed : [parsed]

    return items.flatMap((item) => {
      if (item == null || typeof item !== 'object') return []
      const obj = item as Record<string, unknown>
      const pid = typeof obj['ProcessId'] === 'number' ? obj['ProcessId'] : null
      const cmdLine = typeof obj['CommandLine'] === 'string' ? obj['CommandLine'] : ''
      const cwd = typeof obj['WorkingDirectory'] === 'string' ? obj['WorkingDirectory'] : ''

      if (pid == null || !cwd || !existsSync(cwd)) return []

      return [{
        pid,
        cwd,
        sessionId: extractSessionId(cmdLine),
        promptSnippet: extractPromptSnippet(cmdLine),
      }]
    })
  } catch {
    return []
  }
}

function discoverUnix(): DiscoveredProcess[] {
  try {
    const raw = execSync("ps aux | grep 'claude -p' | grep -v grep", {
      encoding: 'utf-8',
      timeout: 5000,
    }).trim()

    if (!raw) return []

    return raw.split('\n').flatMap(line => {
      const parts = line.trim().split(/\s+/)
      const pid = parseInt(parts[1] ?? '', 10)
      if (isNaN(pid)) return []

      const cmdStart = parts.slice(10).join(' ')
      const sessionId = extractSessionId(cmdStart)
      const promptSnippet = extractPromptSnippet(cmdStart)

      // On Linux, read cwd from /proc/<pid>/cwd
      let cwd = ''
      try {
        cwd = execSync(`readlink -f /proc/${pid}/cwd`, { encoding: 'utf-8', timeout: 2000 }).trim()
      } catch {}
      if (!cwd || !existsSync(cwd)) return []

      return [{ pid, cwd, sessionId, promptSnippet }]
    })
  } catch {
    return []
  }
}

export async function GET() {
  const isWindows = process.platform === 'win32'
  const processes = isWindows ? discoverWindows() : discoverUnix()
  return NextResponse.json({ processes })
}
