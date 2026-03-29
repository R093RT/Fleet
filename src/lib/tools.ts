export const DEFAULT_ALLOWED_TOOLS = [
  'Read', 'Write', 'Edit',
  'Bash(npm run *)', 'Bash(npx *)', 'Bash(node *)',
  'Bash(git add *)', 'Bash(git commit *)', 'Bash(git status)',
  'Bash(git diff *)', 'Bash(git log *)', 'Bash(git branch *)',
  'Bash(git checkout *)', 'Bash(git stash *)',
  'Bash(cat *)', 'Bash(ls *)', 'Bash(mkdir *)', 'Bash(grep *)',
  'Bash(find *)', 'Bash(echo *)', 'Bash(head *)', 'Bash(tail *)',
  'Bash(npx prisma *)', 'Bash(npx eslint *)', 'Bash(npx jest *)',
] as const

export type AgentModel = 'default' | 'haiku' | 'sonnet' | 'opus'

/** Map Fleet model names to Claude CLI model identifiers. Update here when new versions ship. */
const MODEL_MAP: Record<string, string> = {
  haiku: 'claude-haiku-4-5',
  sonnet: 'claude-sonnet-4-5',
  opus: 'claude-opus-4-5',
}

/** Resolve a Fleet model name to Claude CLI --model arguments. Returns [] for 'default'. */
export function modelCliArgs(model: AgentModel | undefined): string[] {
  if (!model || model === 'default') return []
  const resolved = MODEL_MAP[model]
  if (!resolved) return []
  return ['--model', resolved]
}
