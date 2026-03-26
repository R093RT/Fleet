# Fleet — CLAUDE.md

## What this is

Fleet is a Next.js 15 dashboard for running and coordinating multiple Claude Code agents across local git repos. It runs on **localhost:4000** and acts as a command center: spawn agents with prompts, watch their terminal output live via SSE, review git diffs, approve plans, and pass signals between agents.

It is not a hosted service. Fleet runs entirely on your machine. Claude Code CLI processes are spawned as child processes. All state is local (localStorage + local filesystem).

---

## Stack

- **Next.js 15.1** — App Router, all routes in `src/app/`
- **React 19 + TypeScript 5.7** — strict mode, no JS files
- **Zustand 5** — all client state, persisted to localStorage under key `fleet-store`
- **Tailwind CSS 3.4** — dark theme, JetBrains Mono everywhere
- **Node.js child_process** — `spawn()` and `execSync()` to call `claude` CLI and `git`

---

## File structure

```
src/
  app/
    page.tsx              ← entire UI (SetupWizard + Dashboard + all modals/cards)
    layout.tsx            ← minimal HTML shell, dark class, metadata
    globals.css           ← CSS vars, JetBrains Mono import, scrollbar styling
    api/
      stream/route.ts     ← primary agent spawn; returns SSE stream
      spawn/route.ts      ← fire-and-forget spawn; returns { pid, sessionId }
      send-message/route.ts ← resume session (execSync, blocking, 5min timeout)
      git-status/route.ts ← polls branch/uncommitted/unpushed for a list of paths
      diff/route.ts       ← git diff in 4 modes (staged/unstaged/last-commit/unpushed)
      signals/route.ts    ← file-based inter-agent signals (JSON file on disk)
      roadmap/route.ts    ← read/write markdown file at ROADMAP_PATH env var
      watch/route.ts      ← SSE file watcher for a repo path
      screenshot/route.ts ← Playwright screenshot or URL reachability fallback
      worktree/route.ts   ← create/delete per-agent git worktrees
  components/
    StreamingTerminal.tsx ← terminal UI; orchestrates worktree creation + stream fetch
    DiffViewer.tsx        ← diff mode selector + syntax-colored output
    SignalsPanel.tsx       ← inter-agent signal board (polls every 10s)
  lib/
    store.ts              ← Zustand store; Agent interface; all persistent state
```

---

## Core data model

`Agent` in `src/lib/store.ts` is the central type. Everything in the UI is derived from it.

```typescript
interface Agent {
  // Identity
  id: string          // unique; used as process key + worktree subdir name
  name: string
  role: string
  repo: string        // folder name only (derived from path on add)
  path: string        // absolute path to the main repo checkout (user-set)
  color: string       // hex, used in card header
  icon: string        // emoji
  devPort: number | null
  previewPath: string // default '/'

  // Worktree isolation (null until first spawn in a git repo)
  worktreePath: string | null   // .fleet/worktrees/<id>/
  worktreeBranch: string | null // fleet/<id>

  // Status / task tracking
  status: 'idle' | 'running' | 'needs-input' | 'reviewing' | 'done' | 'error'
  task: string
  score: number | null
  notes: string
  plan: string
  planApproved: boolean | null
  lastUpdate: number | null
  sessionId: string | null   // Claude Code CLI session ID for --resume

  // Live data (not persisted across reloads)
  git: GitInfo | null        // polled every 15s
  messages: AgentMessage[]   // last 200 in memory, last 50 persisted
  isStreaming: boolean
}
```

**If you add a field to `Agent`:**
1. Add to the `Agent` interface
2. Initialize it in `makeAgent()`
3. Add to `partialize` in the persist config (or explicitly exclude it)

---

## How agent spawning works end-to-end

1. User types a prompt in `StreamingTerminal`
2. On first send, if `!agent.worktreePath`:
   - `POST /api/worktree` → creates `git worktree add -b fleet/<id> .fleet/worktrees/<id>/ HEAD` in the source repo
   - `{ worktreePath, branchName }` stored in agent via `updateAgent()`
   - Falls back silently to `agent.path` if the repo is not a git repo
3. `POST /api/stream` with `{ agentId, repoPath: worktreePath || path, prompt, sessionId }`
4. Server spawns: `claude -p "<prompt>" --output-format stream-json --max-turns 50 --allowedTools ...`
   - `cwd` is the resolved `repoPath`
   - `shell: true` — required on Windows for `claude` to resolve in PATH
5. stdout → JSON-lines → SSE `data:` events → browser reads via `ReadableStream`
6. `type: result` event → agent marked `done`; desktop notification sent; `sessionId` captured
7. Subsequent sends pass `sessionId` → CLI called with `--session-id <id> --resume`

---

## API routes

| Method | Path | Input | Output |
|--------|------|-------|--------|
| POST | `/api/stream` | `{ agentId, repoPath, prompt, sessionId?, allowedTools? }` | SSE stream |
| POST | `/api/spawn` | `{ agentId, repoPath, prompt, allowedTools? }` | `{ success, pid, sessionId }` |
| POST | `/api/send-message` | `{ repoPath, sessionId, prompt, allowedTools? }` | `{ success, response, sessionId }` |
| POST | `/api/git-status` | `{ paths: string[] }` | `{ [path]: GitInfo \| null }` |
| POST | `/api/diff` | `{ repoPath, mode? }` | `{ diff, summary, files, truncated }` |
| GET | `/api/signals` | `?agent=&unresolved=` | `{ signals }` |
| POST | `/api/signals` | `{ from, to, type, message }` | `{ success, signal }` |
| PATCH | `/api/signals` | `{ signalId }` | `{ success }` |
| GET | `/api/roadmap` | — | `{ content, exists }` |
| PUT | `/api/roadmap` | `{ content }` | `{ success }` |
| GET | `/api/watch` | `?path=` | SSE stream |
| POST | `/api/screenshot` | `{ agentId, url }` | `{ success, path? }` |
| POST | `/api/worktree` | `{ agentId, repoPath }` | `{ worktreePath, branchName }` or `{ error, fallback: true }` |
| DELETE | `/api/worktree` | `{ worktreePath, repoPath }` | `{ success }` |

**SSE event types from `/api/stream`:**
- `assistant` — has `text` and `toolUses[]`
- `result` — final output; has `text`, `cost`, `subtype`, `sessionId`
- `system` — init/setup messages
- `tool_result` — tool execution result
- `done` — process exited; has `exitCode`
- `error` — process error

---

## Worktree isolation

Each agent running in a git repo gets an isolated branch and working directory:

- **Location**: `<Fleet-root>/.fleet/worktrees/<agentId>/` (gitignored)
- **Branch**: `fleet/<agentId>` in the source repo
- **Created**: automatically on first Terminal send
- **Cleaned up**: when agent is removed (directory deleted; branch preserved for merging)
- **Idempotent**: if the directory already exists (app restart), it is reused

If the agent's `path` is not a git repo, worktree creation fails silently and the agent works directly from `path`.

---

## Signals

Lightweight pub/sub for agent coordination. Stored as a JSON file on disk.

- **Default location**: `.fleet/signals/signals.json` (inside Fleet project, gitignored)
- **Override**: set `SIGNALS_DIR` in `.env`
- **Types**: `handoff` | `blocker` | `update` | `request` | `done`
- **Lifecycle**: created (unresolved) → marked resolved; never deleted
- **Polling**: `SignalsPanel` polls every 10 seconds

---

## Environment variables

```
ANTHROPIC_API_KEY=   # required — passed to claude CLI via process.env
ROADMAP_PATH=        # optional — absolute path to a .md file for the Roadmap modal
SIGNALS_DIR=         # optional — defaults to .fleet/signals/ inside Fleet
```

Fleet does **not** call the Anthropic API directly. It only spawns the `claude` CLI, which reads `ANTHROPIC_API_KEY` from the environment.

---

## Styling conventions

- Dark-only. No light mode.
- Background: `#08090d` (surface), `#0f1117` (surface-raised)
- Accent: amber `#d4a843`, navy `#1a2332`
- Text hierarchy via opacity: `rgba(255,255,255,0.9)` primary · `0.4` secondary · `0.2` muted — often applied as inline `style` rather than Tailwind classes
- Borders: `rgba(255,255,255,0.06)` — `border-white/5` and `border-white/8` used frequently
- Status colors live in `STATUS_OPTIONS` at the top of `page.tsx` — don't hardcode them elsewhere
- Agent accent color is user-chosen — always use `agent.color`, never a constant

---

## First-run setup wizard

On load, if `store.setupComplete === false`, `Dashboard` renders `SetupWizard` full-screen instead of the main UI. Two screens:

1. Welcome + install hint for `claude` CLI
2. Add first agent form (name, role, path, dev port, icon, color)

Submitting calls `setSetupComplete(true)` and redirects to the dashboard.

---

## Known issues / things to fix

- No authentication — Fleet is local-only; do not expose port 4000 externally
- `diff/route.ts` checks `existsSync(path.join(repoPath, '.git'))` — this works correctly for both normal repos (`.git` dir) and worktrees (`.git` file)

---

## Running locally

```bash
# Windows
powershell -ExecutionPolicy Bypass -File setup.ps1

# Mac / Linux
bash setup.sh

# Then
npm run dev
# → http://localhost:4000
```

Prerequisites: Node.js 20+, `claude` CLI (`npm install -g @anthropic-ai/claude-code`), `ANTHROPIC_API_KEY` in `.env`.
