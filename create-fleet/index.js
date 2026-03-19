#!/usr/bin/env node
'use strict'

const readline = require('readline')
const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

// ─── Colours ─────────────────────────────────────────────────────────────────
const amber = (s) => `\x1b[33m${s}\x1b[0m`
const green = (s) => `\x1b[32m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const bold = (s) => `\x1b[1m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`

// ─── Icon / colour palettes (matches Fleet's AgentForm) ──────────────────────
const ICONS = { worker: '⚙️', quartermaster: '🧠' }
const COLORS = [
  '#2563eb', '#3b82f6', '#059669', '#0d9488',
  '#d97706', '#7c3aed', '#e11d48', '#06b6d4',
  '#84cc16', '#f97316', '#8b5cf6', '#ec4899',
]

// ─── YAML helpers ─────────────────────────────────────────────────────────────
// Unconditionally double-quote a string value and escape interior quotes/backslashes.
function yamlStr(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"'
}

// ─── Prompt helpers ───────────────────────────────────────────────────────────
function createRl() {
  return readline.createInterface({ input: process.stdin, output: process.stdout })
}

async function ask(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    const hint = defaultValue ? dim(` (${defaultValue})`) : ''
    rl.question(`  ${question}${hint}: `, (answer) => {
      resolve(answer.trim() || defaultValue)
    })
  })
}

async function confirm(rl, question, defaultYes = true) {
  const hint = defaultYes ? 'Y/n' : 'y/N'
  const answer = await ask(rl, `${question} ${dim(`[${hint}]`)}`, '')
  if (!answer) return defaultYes
  return answer.toLowerCase().startsWith('y')
}

async function askInt(rl, question, defaultValue, min = 0) {
  while (true) {
    const raw = await ask(rl, question, String(defaultValue))
    const n = parseInt(raw, 10)
    if (!isNaN(n) && n >= min) return n
    console.log(`  ${amber('!')} Please enter a number (${min} or more)`)
  }
}

// ─── Prerequisite checks ──────────────────────────────────────────────────────
function checkPrereqs() {
  console.log('\n' + bold('Checking prerequisites…'))

  const nodeVer = parseInt(process.version.slice(1), 10)
  if (nodeVer < 20) {
    console.log(`  ${amber('!')} Node.js ${process.version} — need 20+ (continuing anyway)`)
  } else {
    console.log(`  ${green('✓')} Node.js ${process.version}`)
  }

  const git = spawnSync('git', ['--version'], { encoding: 'utf8', shell: true })
  if (git.status !== 0) {
    console.log(`  ${red('✗')} git not found — required to clone Fleet`)
    process.exit(1)
  }
  console.log(`  ${green('✓')} git`)

  const claude = spawnSync('claude', ['--version'], { encoding: 'utf8', shell: true })
  if (claude.status !== 0) {
    console.log(`  ${amber('!')} claude CLI not found — install with: npm install -g @anthropic-ai/claude-code`)
  } else {
    console.log(`  ${green('✓')} claude CLI (${(claude.stdout ?? '').trim() || 'installed'})`)
  }

  if (!process.env['ANTHROPIC_API_KEY']) {
    console.log(`  ${amber('!')} ANTHROPIC_API_KEY not set — you will be prompted to add it to .env`)
  } else {
    console.log(`  ${green('✓')} ANTHROPIC_API_KEY`)
  }
}

// ─── Clone or locate Fleet ────────────────────────────────────────────────────
async function resolveTargetDir(rl, dirArg) {
  let targetDir = dirArg

  if (!targetDir) {
    targetDir = await ask(rl, 'Install Fleet to directory', './fleet')
  }

  targetDir = path.resolve(targetDir)

  if (fs.existsSync(path.join(targetDir, 'src', 'app', 'page.tsx'))) {
    console.log(`\n  ${green('✓')} Existing Fleet found at ${dim(targetDir)} — config-only mode`)
    return targetDir
  }

  if (fs.existsSync(targetDir) && fs.readdirSync(targetDir).length > 0) {
    console.log(`\n  ${amber('!')} Directory ${targetDir} exists and is not empty`)
    const proceed = await confirm(rl, '  Install anyway?', false)
    if (!proceed) process.exit(0)
  }

  console.log(`\n  Cloning Fleet → ${dim(targetDir)}…`)
  const result = spawnSync(
    'git',
    ['clone', 'https://github.com/R093RT/Fleet.git', targetDir],
    { encoding: 'utf8', shell: true, stdio: 'inherit' }
  )
  if (result.status !== 0) {
    console.error(red('  ✗ git clone failed'))
    process.exit(1)
  }
  console.log(`  ${green('✓')} Cloned`)
  return targetDir
}

// ─── Environment setup ────────────────────────────────────────────────────────
async function setupEnv(rl, targetDir) {
  const envPath = path.join(targetDir, '.env')
  const envExamplePath = path.join(targetDir, '.env.example')

  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath)
    } else {
      fs.writeFileSync(envPath, '# Fleet environment\nANTHROPIC_API_KEY=\n')
    }
  }

  if (!process.env['ANTHROPIC_API_KEY']) {
    console.log(`\n${bold('Anthropic API key')}`)
    console.log(`  Get one at ${dim('https://console.anthropic.com/')}`)
    const key = await ask(rl, 'ANTHROPIC_API_KEY', '')
    if (key) {
      let env = fs.readFileSync(envPath, 'utf-8')
      env = env.includes('ANTHROPIC_API_KEY=')
        ? env.replace(/ANTHROPIC_API_KEY=.*/, `ANTHROPIC_API_KEY=${key}`)
        : env + `\nANTHROPIC_API_KEY=${key}\n`
      fs.writeFileSync(envPath, env)
      console.log(`  ${green('✓')} Saved to .env`)
    }
  }
}

// ─── Agent wizard ─────────────────────────────────────────────────────────────
async function defineAgents(rl) {
  console.log(`\n${bold('Define your agents')}`)
  const count = await askInt(rl, 'How many agents? (0 for empty template)', 1, 0)
  if (count === 0) return []

  const agents = []
  for (let i = 0; i < count; i++) {
    console.log(`\n  ${amber(`Agent ${i + 1}`)} ${'─'.repeat(32)}`)
    const name = await ask(rl, 'Name', i === 0 ? 'Frontend' : `Agent ${i + 1}`)
    const role = await ask(rl, 'Role', i === 0 ? 'Build and maintain the UI' : '')
    const agentPath = await ask(rl, 'Absolute path to repo', '')
    const devPortStr = await ask(rl, 'Dev port (optional)', '')
    const agentType = await ask(rl, 'Type (worker/quartermaster)', i === count - 1 && count > 1 ? 'quartermaster' : 'worker')
    const type = agentType === 'quartermaster' ? 'quartermaster' : 'worker'
    agents.push({
      name,
      role: role || undefined,
      path: agentPath || `/path/to/${name.toLowerCase().replace(/\s+/g, '-')}`,
      devPort: devPortStr ? parseInt(devPortStr, 10) : undefined,
      agentType: type,
      icon: ICONS[type],
      color: COLORS[i % COLORS.length],
    })
  }
  return agents
}

// ─── Reactions wizard ─────────────────────────────────────────────────────────
async function defineReactions(rl, agents) {
  const reactions = []
  const defaultAgent = agents[0]?.name ?? 'MyAgent'

  while (true) {
    const prompt = reactions.length === 0 ? '\nAdd a reaction rule?' : '\nAdd another reaction?'
    const add = await confirm(rl, prompt, false)
    if (!add) break

    console.log(`\n  ${amber(`Reaction ${reactions.length + 1}`)} ${'─'.repeat(28)}`)
    const name = await ask(rl, 'Name', 'Test failure → fix')
    const triggerAgent = await ask(rl, 'Trigger: watch agent', defaultAgent)
    const triggerPath = await ask(rl, 'Trigger: filename substring', 'test-results')
    const actionMsg = await ask(rl, 'Action: prompt message', 'Tests changed. Run tests, identify failures, and fix them.')
    const cooldown = await askInt(rl, 'Cooldown (seconds)', 300, 0)
    reactions.push({
      name,
      trigger: { type: 'file_change', agent: triggerAgent, path: triggerPath },
      action: { type: 'send_prompt', agent: triggerAgent, message: actionMsg },
      cooldown,
    })
  }
  return reactions
}

// ─── Agent review step ────────────────────────────────────────────────────────
async function reviewAgents(rl, agents) {
  if (agents.length === 0) return agents

  console.log(`\n${bold('Review agents')} ${'─'.repeat(30)}`)
  for (const a of agents) {
    console.log(`  ${a.icon} ${bold(a.name)} ${dim(`(${a.agentType})`)} — ${dim(a.path)}`)
    if (a.role) console.log(`       ${dim(a.role)}`)
  }

  const redo = await confirm(rl, '\nRe-enter agents?', false)
  if (redo) return await defineAgents(rl)
  return agents
}

// ─── Build fleet.yaml string ──────────────────────────────────────────────────
function buildFleetYaml(agents, reactions) {
  let yaml = '# Generated by create-fleet\n'

  if (agents.length > 0) {
    yaml += '\nagents:\n'
    for (const a of agents) {
      yaml += `  - name: ${yamlStr(a.name)}\n`
      if (a.role) yaml += `    role: ${yamlStr(a.role)}\n`
      yaml += `    path: ${yamlStr(a.path)}\n`
      if (a.devPort) yaml += `    devPort: ${a.devPort}\n`
      yaml += `    agentType: ${a.agentType}\n`
      yaml += `    icon: ${yamlStr(a.icon)}\n`
      yaml += `    color: ${yamlStr(a.color)}\n`
    }
  }

  if (reactions.length > 0) {
    yaml += '\nreactions:\n'
    for (const r of reactions) {
      yaml += `  - name: ${yamlStr(r.name)}\n`
      yaml += `    trigger:\n`
      yaml += `      type: ${r.trigger.type}\n`
      yaml += `      agent: ${yamlStr(r.trigger.agent)}\n`
      if (r.trigger.path) yaml += `      path: ${yamlStr(r.trigger.path)}\n`
      yaml += `    action:\n`
      yaml += `      type: ${r.action.type}\n`
      yaml += `      agent: ${yamlStr(r.action.agent)}\n`
      if (r.action.message) yaml += `      message: ${yamlStr(r.action.message)}\n`
      yaml += `    cooldown: ${r.cooldown}\n`
    }
  } else {
    const ex = agents[0]?.name ?? 'MyAgent'
    yaml += `\nreactions:\n`
    yaml += `  # Uncomment to activate reactions\n`
    yaml += `  # - name: "Test failure → fix"\n`
    yaml += `  #   trigger:\n`
    yaml += `  #     type: file_change\n`
    yaml += `  #     agent: ${yamlStr(ex)}\n`
    yaml += `  #     path: "test-results"\n`
    yaml += `  #   action:\n`
    yaml += `  #     type: send_prompt\n`
    yaml += `  #     agent: ${yamlStr(ex)}\n`
    yaml += `  #     message: "Tests changed. Run tests and fix failures."\n`
    yaml += `  #   cooldown: 300\n`
  }

  return yaml
}

// ─── Preview + confirm before writing ────────────────────────────────────────
async function confirmAndWrite(rl, targetDir, agents, reactions) {
  const yaml = buildFleetYaml(agents, reactions)
  const yamlPath = path.join(targetDir, 'fleet.yaml')

  console.log(`\n${bold('Preview')} ${dim('─'.repeat(34))}`)
  const lines = yaml.split('\n')
  for (const line of lines.slice(0, 30)) {
    console.log('  ' + line)
  }
  if (lines.length > 30) console.log('  ' + dim('…'))

  const write = await confirm(rl, `\nWrite to ${dim(yamlPath)}?`, true)
  if (!write) {
    console.log(`  ${amber('!')} Skipped — run create-fleet again to generate config`)
    return
  }

  fs.writeFileSync(yamlPath, yaml, 'utf-8')
  console.log(`  ${green('✓')} Wrote ${dim(yamlPath)}`)
}

// ─── Install deps ─────────────────────────────────────────────────────────────
async function installDeps(rl, targetDir) {
  if (fs.existsSync(path.join(targetDir, 'node_modules'))) {
    console.log(`\n  ${green('✓')} Dependencies already installed`)
    return
  }

  const doInstall = await confirm(rl, '\nRun npm ci to install dependencies?', true)
  if (!doInstall) return

  console.log(`  Installing…`)
  const result = spawnSync('npm', ['ci'], { cwd: targetDir, shell: true, stdio: 'inherit' })
  if (result.status !== 0) {
    console.log(`  ${amber('!')} npm ci failed — run it manually in ${targetDir}`)
  } else {
    console.log(`  ${green('✓')} Dependencies installed`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n' + amber(bold('  Fleet')) + dim('  — Claude Code agent dashboard'))
  console.log(dim('  ─────────────────────────────────────'))

  const rl = createRl()

  checkPrereqs()

  const targetDir = await resolveTargetDir(rl, process.argv[2])
  await setupEnv(rl, targetDir)
  const rawAgents = await defineAgents(rl)
  const agents = await reviewAgents(rl, rawAgents)
  const reactions = await defineReactions(rl, agents)
  await confirmAndWrite(rl, targetDir, agents, reactions)
  await installDeps(rl, targetDir)

  rl.close()

  const rel = path.relative(process.cwd(), targetDir) || targetDir
  console.log('\n' + green(bold('  ✓ Fleet is ready!')))
  console.log(dim('  ─────────────────────────────────────'))
  console.log(`  ${dim('Run:')}  cd ${rel} && npm run dev`)
  console.log(`         → http://localhost:4000\n`)
}

main().catch((e) => {
  console.error(red('\nError: ') + (e instanceof Error ? e.message : String(e)))
  process.exit(1)
})
