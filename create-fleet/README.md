# create-fleet

> One-command installer for [Fleet](https://github.com/R093RT/Fleet) — the Claude Code agent dashboard.

## Usage

```bash
npx create-fleet
# or
npx create-fleet ./my-fleet
```

This will:

1. Check prerequisites (Node 20+, git, claude CLI, `ANTHROPIC_API_KEY`)
2. Clone Fleet into the target directory (or use an existing installation)
3. Set up `.env` with your API key
4. Walk you through defining agents and reaction rules
5. Generate `fleet.yaml` with a preview before writing
6. Run `npm ci` to install dependencies

Then start Fleet:

```bash
cd fleet && npm run dev
# → http://localhost:4000
```

## Requirements

- Node.js 20+
- git
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) — `npm install -g @anthropic-ai/claude-code`
- `ANTHROPIC_API_KEY`

## What is Fleet?

Fleet is a local dashboard for running and coordinating multiple Claude Code agents across your repos. It provides live terminal streaming, git worktree isolation, plan approval, score-driven iteration, cost tracking, and more.

See the [Fleet README](https://github.com/R093RT/Fleet#readme) for full documentation.
