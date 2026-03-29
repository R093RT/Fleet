import type { AgentStatus } from './store'

export interface KeywordMatch {
  keyword: string
  label: string
  color: string
  promptPrefix?: string
  agentUpdates?: { status?: AgentStatus; autoIterate?: boolean }
}

const KEYWORD_RULES: KeywordMatch[] = [
  {
    keyword: 'review',
    label: 'Review',
    color: '#60a5fa',
    promptPrefix:
      '[MODE: REVIEW] Focus on reviewing code quality, correctness, and potential issues. Provide structured feedback with severity levels.\n\n',
    agentUpdates: { status: 'reviewing' },
  },
  {
    keyword: 'ship',
    label: 'Ship',
    color: '#4ade80',
    promptPrefix:
      '[MODE: SHIP] Aim for production-quality output. Be thorough, test everything, and ensure completeness.\n\n',
    agentUpdates: { autoIterate: true },
  },
  {
    keyword: 'explore',
    label: 'Explore',
    color: '#c084fc',
    promptPrefix:
      '[MODE: EXPLORE] Read-only exploration. Do NOT modify any files. Only read, analyze, and report findings.\n\n',
  },
  {
    keyword: 'plan',
    label: 'Plan',
    color: '#fbbf24',
    promptPrefix:
      '[MODE: PLAN] Create a detailed implementation plan before writing any code. Wait for approval before proceeding.\n\n',
  },
]

/** Strip fenced and inline code blocks to avoid false keyword matches in code. */
function stripCodeBlocks(text: string): string {
  return text.replace(/```[\s\S]*?```/g, '').replace(/`[^`]+`/g, '')
}

/** Detect informational intent to skip keywords in questions like "what is review?". */
function isInformationalQuery(text: string): boolean {
  return /^(what|how|why|when|where|explain|describe|define)\b/i.test(text.trim())
}

/** Detect magic keywords in a prompt. Returns matching keyword rules. */
export function detectKeywords(prompt: string): KeywordMatch[] {
  if (isInformationalQuery(prompt)) return []

  const stripped = stripCodeBlocks(prompt).toLowerCase()
  return KEYWORD_RULES.filter((rule) => {
    const regex = new RegExp(`\\b${rule.keyword}\\b`, 'i')
    return regex.test(stripped)
  })
}

/** Apply keyword effects: modify prompt and collect agent updates. */
export function applyKeywords(
  prompt: string,
  matches: KeywordMatch[],
): { modifiedPrompt: string; agentUpdates: Record<string, unknown> } {
  let modifiedPrompt = prompt
  let agentUpdates: Record<string, unknown> = {}

  for (const match of matches) {
    if (match.promptPrefix) {
      modifiedPrompt = match.promptPrefix + modifiedPrompt
    }
    if (match.agentUpdates) {
      agentUpdates = { ...agentUpdates, ...match.agentUpdates }
    }
  }

  return { modifiedPrompt, agentUpdates }
}
