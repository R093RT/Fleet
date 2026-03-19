# Fleet

> Run a team of Claude Code agents from one dashboard.

<!-- GIF: spawn agent → watch stream → review diff → approve plan -->
<!-- Record: npx create-fleet setup, agent card expand, live terminal, git badge, screenshot diff -->

---

## Features

| | |
|---|---|
| **Live terminal streaming** | Watch agents work in real time via SSE — tool calls, text, costs |
| **Worktree isolation** | Each agent gets its own git branch + working directory automatically |
| **Plan approval** | Agents can propose plans before executing; you approve or reject |
| **Score-driven iteration** | Agents self-improve until they hit your quality threshold (e.g. 85/100) |
| **Reactions** | Trigger agent prompts automatically on file changes or port events |
| **Cost tracking** | Per-session and daily spend with configurable budget caps |
| **QR mobile remote** | Open Fleet on any device on your local network |
| **Roadmap sync** | Shared markdown roadmap injected into Quartermaster agent prompts |
| **Git status** | Live branch / uncommitted / unpushed badges on every agent card |
| **Screenshot diff** | Pixel-level before/after comparison for UI agents |
| **Session recovery** | Sessions survive dashboard restarts via `--resume` |
| **Worktree cleanup** | Branches preserved for merging; directories removed on agent delete |

---

## Quick start

```bash
npx create-fleet
```

This checks prerequisites, clones Fleet, asks you to define your agents, and generates `fleet.yaml`. Then:

```bash
cd fleet && npm run dev
# → http://localhost:4000
```

### Manual install

```bash
git clone https://github.com/R093RT/Fleet.git
cd Fleet
cp .env.example .env   # add ANTHROPIC_API_KEY
npm install
npm run dev
```

---

## Requirements

- **Node.js 20+**
- **Claude Code CLI** — `npm install -g @anthropic-ai/claude-code`
- **ANTHROPIC_API_KEY** — in `.env` or shell environment
- Git (for worktree isolation)

---

## fleet.yaml

Place `fleet.yaml` at Fleet's root to define agents and reactions. Fleet reads it on startup.

```yaml
agents:
  - name: Frontend
    role: Build the Next.js UI
    path: /absolute/path/to/my-project
    devPort: 3000
    agentType: worker
    icon: "⚙️"
    color: "#2563eb"

  - name: Quartermaster
    role: Coordinate work, maintain roadmap
    path: /absolute/path/to/my-project
    agentType: quartermaster
    icon: "🧠"
    color: "#7c3aed"

reactions:
  - name: "Test failure → fix"
    trigger:
      type: file_change
      agent: Frontend
      path: "test-results"
    action:
      type: send_prompt
      agent: Frontend
      message: "Test results changed. Run tests, identify failures, and fix them."
    cooldown: 300   # seconds

  - name: "Dev server down → restart"
    trigger:
      type: port_unavailable
      agent: Frontend
      port: 3000
    action:
      type: send_prompt
      agent: Frontend
      message: "Dev server on port 3000 is down. Please restart it."
    cooldown: 120
```

### Agent fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Display name |
| `path` | ✅ | Absolute path to the repo |
| `role` | | System role description |
| `devPort` | | Port for the live preview iframe |
| `agentType` | | `worker` (default) or `quartermaster` |
| `icon` | | Emoji icon |
| `color` | | Hex color for the card header |

### Reaction trigger types

| Type | When it fires |
|------|--------------|
| `file_change` | A file matching `path` (substring) changes in the agent's repo |
| `port_unavailable` | A localhost port fails to respond 3 times in a row |

### Reaction action types

| Type | Effect |
|------|--------|
| `send_prompt` | Sends `message` to the agent (supports `{filename}` placeholder) |
| `set_status` | Sets agent status to `status` |

---

## Architecture

```
localhost:4000
├── /api/stream          SSE: spawns claude -p, streams JSON output
├── /api/git-status      Polls branch/uncommitted/unpushed per repo path
├── /api/diff            git diff in 4 modes (staged/unstaged/last-commit/unpushed)
├── /api/fleet-config    Reads fleet.yaml (agents + reactions)
├── /api/reactions       Reads reactions from fleet.yaml
├── /api/signals         Agent-to-agent coordination (handoffs, blockers, requests)
├── /api/roadmap         Reads/writes roadmap markdown file from disk
├── /api/watch           SSE file watcher per repo (used by reactions engine)
├── /api/screenshot      Playwright screenshot for UI diff
├── /api/worktree        Create/delete per-agent git worktrees
├── /api/sessions        Persist/recover session stats (cost, turns, tokens)
├── /api/local-ip        Returns LAN IP for QR mobile link
└── /api/kill            Kills a running agent process
```

**Stack:** Next.js 15.1, React 19, TypeScript 5.7 strict, Zustand 5, Tailwind 3.4, Vitest

All state is local — localStorage (agent config) + filesystem (signals, sessions, reactions). No external services, no cloud.

---

## vs alternatives

|  | Fleet | Composio | E2B | AgentOps |
|--|-------|----------|-----|---------|
| Local-first | ✅ | ❌ | ❌ | ❌ |
| Zero cloud | ✅ | ❌ | ❌ | ❌ |
| Multi-agent dashboard | ✅ | partial | ❌ | ❌ |
| Live SSE streaming | ✅ | ❌ | ❌ | ❌ |
| Git worktree isolation | ✅ | ❌ | ❌ | ❌ |
| Reaction automation | ✅ | via webhooks | ❌ | ❌ |
| File-based signals | ✅ | ❌ | ❌ | ❌ |

---

## Agent types

**Worker** — does focused implementation work in a single repo. Gets its own worktree branch, runs prompts directly, streams output.

**Quartermaster** — coordinates across agents. Has `injectRoadmap` enabled by default — the shared roadmap is prepended to every prompt so it can track cross-repo progress and issue signals.

---

## Keyboard shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+R` | Open roadmap |
| `Escape` | Close modals |

---

## Environment variables

```
ANTHROPIC_API_KEY=    # required — passed to claude CLI
ROADMAP_PATH=         # optional — absolute path to roadmap .md file
SIGNALS_DIR=          # optional — defaults to .fleet/signals/
REACTIONS_CONFIG=     # optional — defaults to fleet.yaml at Fleet root
```

---

## Known limitations

- Sessions use `claude -p` (headless mode), not the interactive TUI
- `send-message/route.ts` uses `execSync` — blocks the Node thread for up to 5 min per call
- No authentication — never expose port 4000 externally
- Reactions run in the browser tab — keep Fleet open for them to fire
