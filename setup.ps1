# setup.ps1 — Run once to get Fleet working on Windows
# Usage: powershell -ExecutionPolicy Bypass -File setup.ps1

Write-Host "`n=== Fleet Setup ===" -ForegroundColor Yellow

# Check Node.js
$nodeVersion = node --version 2>$null
if (-not $nodeVersion) {
    Write-Host "ERROR: Node.js not found. Install from https://nodejs.org" -ForegroundColor Red
    exit 1
}
Write-Host "Node.js: $nodeVersion" -ForegroundColor Green

# Check Claude Code CLI
$claudeVersion = claude --version 2>$null
if (-not $claudeVersion) {
    Write-Host "WARNING: Claude Code CLI not found." -ForegroundColor Yellow
    Write-Host "  Install with: npm install -g @anthropic-ai/claude-code" -ForegroundColor Yellow
    Write-Host "  The dashboard will work but agent spawning won't." -ForegroundColor Yellow
} else {
    Write-Host "Claude Code: $claudeVersion" -ForegroundColor Green
}

# Check ANTHROPIC_API_KEY
if (-not $env:ANTHROPIC_API_KEY) {
    Write-Host "WARNING: ANTHROPIC_API_KEY not set." -ForegroundColor Yellow
    Write-Host "  Add it to your .env file (see .env.example)" -ForegroundColor Yellow
} else {
    Write-Host "ANTHROPIC_API_KEY: set" -ForegroundColor Green
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Cyan
npm install

# Create .env from example if it doesn't exist
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "Created .env from .env.example — add your ANTHROPIC_API_KEY" -ForegroundColor Yellow
    }
}

# Create local signals directory (used by default; override with SIGNALS_DIR in .env)
$signalsDir = Join-Path $PSScriptRoot ".fleet\signals"
if (-not (Test-Path $signalsDir)) {
    New-Item -ItemType Directory -Path $signalsDir -Force | Out-Null
    Write-Host "Created signals directory: $signalsDir" -ForegroundColor Green
}

Write-Host "`n=== Setup Complete ===" -ForegroundColor Yellow
Write-Host "`nTo start:" -ForegroundColor Cyan
Write-Host "  npm run dev" -ForegroundColor White
Write-Host "  Open http://localhost:4000" -ForegroundColor White
Write-Host "`nOn first launch, Fleet will guide you through adding your first agent.`n" -ForegroundColor DarkGray
