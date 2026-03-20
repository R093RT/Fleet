import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const RequestSchema = z.object({
  roadmap: z.string().min(1).max(100_000),
  crewSize: z.number().int().min(1).max(20).optional(),
})

const WorkstreamSchema = z.object({
  name: z.string(),
  description: z.string(),
  tasks: z.array(z.string()),
  complexity: z.number().min(1).max(5),
  dependencies: z.array(z.string()),
  domain: z.string(),
})

const AnalysisResultSchema = z.object({
  summary: z.string(),
  repos: z.array(z.string()),
  workstreams: z.array(WorkstreamSchema),
  recommendedCrewSize: z.number().int().min(1).max(20),
  reasoning: z.string(),
})

export type AnalysisResult = z.infer<typeof AnalysisResultSchema>

function spawnClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json', '--max-turns', '1']
    const child = spawn('claude', args, {
      env: { ...process.env },
      shell: true,
      timeout: 120_000,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString() })
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    child.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) {
        reject(new Error(`claude exited with code ${code}: ${stderr.slice(0, 500)}`))
      } else {
        resolve(stdout)
      }
    })

    child.on('error', (err) => reject(err))
  })
}

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsed = RequestSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 })
    }

    const { roadmap, crewSize } = parsed.data

    const crewConstraint = crewSize
      ? `\n\nCONSTRAINT: The captain wants exactly ${crewSize} crew members. Redistribute the workstreams to fit this crew size. Merge related workstreams or split large ones as needed.`
      : ''

    const analysisPrompt = `You are Fleet's crew formation advisor. Analyze this project roadmap and decompose it into discrete, parallelizable workstreams.

For each workstream determine:
- name: 2-4 word workstream name
- description: what this agent will build/do
- tasks: array of concrete task descriptions
- complexity: 1-5 (1=trivial, 5=massive)
- dependencies: array of other workstream names this depends on
- domain: one of [frontend, backend, testing, devops, database, docs, security, performance, general]

Also detect any repository paths or URLs mentioned in the roadmap.

Return ONLY valid JSON:
{
  "summary": "1-2 sentence overview",
  "repos": ["any paths/URLs found in the roadmap"],
  "workstreams": [{ "name": "...", "description": "...", "tasks": ["..."], "complexity": 1, "dependencies": [], "domain": "frontend" }],
  "recommendedCrewSize": <number>,
  "reasoning": "why this crew size is optimal"
}${crewConstraint}

Here is the roadmap:
---
${roadmap}
---`

    // Spawn claude CLI asynchronously (doesn't block the Node.js event loop)
    const result = await spawnClaude(analysisPrompt)

    // Parse the CLI output — claude --output-format json returns a JSON object with a "result" field
    let analysisJson: unknown
    try {
      const cliOutput = JSON.parse(result) as Record<string, unknown>
      // The result field contains the actual text response
      const text = typeof cliOutput['result'] === 'string' ? cliOutput['result'] : result

      // Try to extract JSON from the text (Claude may wrap it in markdown code blocks)
      const jsonMatch = typeof text === 'string'
        ? text.match(/```(?:json)?\s*([\s\S]*?)```/) ?? [null, text]
        : [null, result]
      const jsonStr = (jsonMatch[1] ?? result).trim()
      analysisJson = JSON.parse(jsonStr)
    } catch {
      // If the outer parse fails, try parsing the raw result directly
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          analysisJson = JSON.parse(jsonMatch[0])
        } else {
          return NextResponse.json({ error: 'Failed to parse analysis result', raw: result.slice(0, 2000) }, { status: 500 })
        }
      } catch {
        return NextResponse.json({ error: 'Failed to parse analysis result', raw: result.slice(0, 2000) }, { status: 500 })
      }
    }

    // Validate with Zod
    const validated = AnalysisResultSchema.safeParse(analysisJson)
    if (!validated.success) {
      return NextResponse.json({
        error: 'Analysis result did not match expected schema',
        details: validated.error.flatten().fieldErrors,
        raw: JSON.stringify(analysisJson).slice(0, 2000),
      }, { status: 500 })
    }

    return NextResponse.json(validated.data)
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Analysis failed: ${message}` }, { status: 500 })
  }
}
