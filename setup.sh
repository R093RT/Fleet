#!/usr/bin/env bash
# setup.sh — Run once to get Fleet working on Mac/Linux
# Usage: bash setup.sh

set -e

echo ""
echo "=== Fleet Setup ==="

# Check Node.js
if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found. Install from https://nodejs.org"
  exit 1
fi
echo "Node.js: $(node --version)"

# Check Claude Code CLI
if ! command -v claude &>/dev/null; then
  echo "WARNING: Claude Code CLI not found."
  echo "  Install with: npm install -g @anthropic-ai/claude-code"
  echo "  The dashboard will work but agent spawning won't."
else
  echo "Claude Code: $(claude --version)"
fi

# Check ANTHROPIC_API_KEY
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "WARNING: ANTHROPIC_API_KEY not set."
  echo "  Add it to your .env file (see .env.example)"
else
  echo "ANTHROPIC_API_KEY: set"
fi

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

# Create .env from example if it doesn't exist
if [ ! -f ".env" ] && [ -f ".env.example" ]; then
  cp .env.example .env
  echo "Created .env from .env.example — add your ANTHROPIC_API_KEY"
fi

# Create local signals directory (used by default; override with SIGNALS_DIR in .env)
SIGNALS_DIR="$(dirname "$0")/.fleet/signals"
if [ ! -d "$SIGNALS_DIR" ]; then
  mkdir -p "$SIGNALS_DIR"
  echo "Created signals directory: $SIGNALS_DIR"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "To start:"
echo "  npm run dev"
echo "  Open http://localhost:4000"
echo ""
echo "On first launch, Fleet will guide you through adding your first agent."
echo ""
