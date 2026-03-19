import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import { parse } from 'yaml'
import { FleetYamlSchema } from '@/lib/fleet-yaml-schema'
import { getConfigPath } from '@/lib/fleet-config-path'

export async function GET() {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    return NextResponse.json({ agents: [], reactions: [] })
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = parse(raw) as unknown
    const result = FleetYamlSchema.safeParse(parsed)

    if (!result.success) {
      return NextResponse.json({
        agents: [],
        reactions: [],
        error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }

    return NextResponse.json({
      agents: result.data.agents ?? [],
      reactions: result.data.reactions ?? [],
    })
  } catch (e: unknown) {
    return NextResponse.json({
      agents: [],
      reactions: [],
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
