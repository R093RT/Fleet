# Agent Command Center

Local orchestration dashboard for managing multiple Claude Code agents across repos.

## What it does

- **Live git status** — polls each repo every 15s for branch, uncommitted changes, unpushed commits
- **Agent terminal** — send prompts to Claude Code headless mode (`claude -p`), maintain sessions
- **Live preview** — embed localhost dev servers (port 3000, 5173, etc.) in-page for UI review
- **Plan approval** — paste agent plans, approve/reject, track self-assessment scores
- **Roadmap sync** — reads/writes your actual `Portfolio_Development_Roadmap.md` from disk
- **Persistent state** — agent configs, tasks, scores, notes persist across restarts
- **Dynamic agents** — add/remove agents and repos on the fly

## Prerequisites

- Node.js 20+
- Claude Code CLI installed (`npm install -g @anthropic-ai/claude-code`)
- ANTHROPIC_API_KEY set in environment (for headless agent spawning)

## Quickstart (Windows PowerShell)

```powershell
cd agent-command-center

# One-time setup — installs deps, deploys .claude/settings.json to your repos, creates .env
powershell -ExecutionPolicy Bypass -File setup.ps1

# Set your API key
$env:ANTHROPIC_API_KEY = "sk-ant-api03-..."

# Start the dashboard
npm run dev

# Open http://localhost:4000
```

## Repo configs (CLAUDE.md files)

The `repo-configs/` folder contains CLAUDE.md files for each agent role. Copy them into each repo root:

```powershell
copy repo-configs\product-backend\CLAUDE.md C:\Users\User\rubber-traceability-poc\CLAUDE.md
copy repo-configs\surveylink\CLAUDE.md C:\Users\User\Resource-Ledger-App\CLAUDE.md
copy repo-configs\carbon\CLAUDE.md C:\Users\User\RL-Carbon\CLAUDE.md
copy repo-configs\marketing\CLAUDE.md C:\Users\User\Projects\resourceledger-marketing\CLAUDE.md
copy repo-configs\pm-brain\CLAUDE.md C:\Users\User\OneDrive\RL-Notes\CLAUDE.md
copy repo-configs\ROADMAP_CONTEXT.md C:\Users\User\OneDrive\RL-Notes\ROADMAP_CONTEXT.md
```

These give each Claude Code agent its role, conventions, and a pointer to the shared roadmap.

## Architecture

```
localhost:4000 (this dashboard)
├── /api/git-status    — reads git info from each repo via shell
├── /api/stream        — SSE streaming of claude -p output in real-time
├── /api/spawn         — starts claude -p in headless mode (non-streaming fallback)
├── /api/send-message  — sends follow-up to existing session (non-streaming)
├── /api/diff          — git diff viewer (working/staged/last-commit/unpushed)
├── /api/signals       — agent-to-agent coordination signals (handoffs, blockers)
├── /api/roadmap       — reads/writes roadmap file from disk
├── /api/watch         — SSE file watcher per repo
└── /api/screenshot    — captures dev server screenshots (needs Playwright)
```

## Agent workflow

1. Expand an agent → Terminal tab
2. Type a prompt (e.g. "Wire the verifier routes with Zod validation")
3. Agent spawns a Claude Code headless session in that repo
4. See response in terminal, review output
5. Send follow-ups in the same session
6. Switch to Preview tab to see UI changes
7. Switch to Control tab to set status, score, approve plans

## Keyboard shortcuts

- `Ctrl+Shift+R` — open roadmap
- `Escape` — close modals

## Limitations

- Agent terminal uses `claude -p` (headless mode), not the interactive Claude Code TUI
- Sessions are per-process — if the dashboard restarts, sessions are lost (but session IDs persist for --resume)
- No real-time streaming yet — responses come back after full completion
- Git push is not automated — you approve pushes manually in your actual terminal
