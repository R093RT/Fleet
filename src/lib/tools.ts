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
