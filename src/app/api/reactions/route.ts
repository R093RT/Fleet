import { NextResponse } from 'next/server'
import { readFileSync, existsSync } from 'fs'
import path from 'path'
import { parse } from 'yaml'
import { z } from 'zod'

const ReactionTriggerSchema = z.object({
  type: z.enum(['file_change', 'port_unavailable']),
  agent: z.string(),
  path: z.string().optional(),
  port: z.number().optional(),
})

const ReactionActionSchema = z.object({
  type: z.enum(['send_prompt', 'set_status']),
  agent: z.string(),
  message: z.string().optional(),
  status: z.string().optional(),
})

const ReactionConfigSchema = z.object({
  name: z.string(),
  trigger: ReactionTriggerSchema,
  action: ReactionActionSchema,
  cooldown: z.number().optional(),
})

const FleetYamlSchema = z.object({
  reactions: z.array(ReactionConfigSchema).optional(),
})

function getConfigPath(): string {
  return process.env['REACTIONS_CONFIG'] ?? path.join(process.cwd(), 'fleet.yaml')
}

export async function GET() {
  const configPath = getConfigPath()

  if (!existsSync(configPath)) {
    return NextResponse.json({ reactions: [] })
  }

  try {
    const raw = readFileSync(configPath, 'utf-8')
    const parsed = parse(raw) as unknown
    const result = FleetYamlSchema.safeParse(parsed)

    if (!result.success) {
      return NextResponse.json({
        reactions: [],
        error: result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '),
      })
    }

    return NextResponse.json({ reactions: result.data.reactions ?? [] })
  } catch (e: unknown) {
    return NextResponse.json({
      reactions: [],
      error: e instanceof Error ? e.message : String(e),
    })
  }
}
