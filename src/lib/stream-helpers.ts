/**
 * Extracted helper functions from StreamingTerminal's sendPrompt.
 * These are pure logic functions (no React state) that return decisions
 * for the component to apply.
 */

import type { Agent } from '@/lib/store'
import type { KeywordMatch } from '@/lib/keywords'
import { detectKeywords, applyKeywords } from '@/lib/keywords'
import { parseScore } from '@/lib/utils'

/** Max bytes for notepad injection (must match notepad.ts) */
const MAX_NOTEPAD_INJECTION_BYTES = 100_000

// ── Budget Gates ──────────────────────────────────────────────────

export interface BudgetCheckResult {
  blocked: boolean
  message?: string
}

export function checkBudgetGates(
  agentBudgetCap: number | null,
  agentSessionCost: number,
  dailyBudgetCap: number | null,
  dailySpend: Record<string, number>,
): BudgetCheckResult {
  if (agentBudgetCap != null && agentSessionCost >= agentBudgetCap) {
    return {
      blocked: true,
      message: `🚫 Blocked — budget cap $${agentBudgetCap.toFixed(2)} reached ($${agentSessionCost.toFixed(4)} used). Reset session or raise cap.`,
    }
  }
  if (dailyBudgetCap != null) {
    const today = new Date().toISOString().slice(0, 10)
    const todaySpend = dailySpend[today] ?? 0
    if (todaySpend >= dailyBudgetCap) {
      return {
        blocked: true,
        message: `🚫 Blocked — daily fleet budget $${dailyBudgetCap.toFixed(2)} reached ($${todaySpend.toFixed(4)} spent today). Raise daily cap to continue.`,
      }
    }
  }
  return { blocked: false }
}

// ── Prompt Injection Pipeline ──────────────────────────────────────

export interface InjectionMessage {
  id: string
  content: string
}

export interface PromptBuildResult {
  effectivePrompt: string
  messages: InjectionMessage[]
  keywordMatches: KeywordMatch[]
  agentUpdates: Record<string, unknown>
}

/** Fetch roadmap/vault/notepad contexts and apply keyword detection. */
export async function buildEffectivePrompt(
  prompt: string,
  agent: Pick<Agent, 'sessionId' | 'agentType' | 'injectRoadmap' | 'injectVault' | 'injectNotepad' | 'id'>,
): Promise<PromptBuildResult> {
  let effectivePrompt = prompt
  const messages: InjectionMessage[] = []
  const agentUpdates: Record<string, unknown> = {}

  // 1. Roadmap injection
  if (!agent.sessionId && (agent.agentType === 'quartermaster' || agent.injectRoadmap)) {
    try {
      const r = await fetch('/api/roadmap')
      const rd = await r.json()
      if (rd.exists && rd.content) {
        effectivePrompt = `[ROADMAP]\n${rd.content as string}\n\n[TASK]\n${prompt}`
        messages.push({ id: `msg-${Date.now()}-ri`, content: `📖 Roadmap injected (${(rd.content.length / 1000).toFixed(1)}k chars)` })
      }
    } catch (e) {
      console.warn('Roadmap injection failed:', e instanceof Error ? e.message : String(e))
    }
  }

  // 2. Vault injection
  if (!agent.sessionId && agent.injectVault) {
    try {
      const v = await fetch('/api/vault')
      const vd = await v.json()
      if (vd.exists && vd.content) {
        effectivePrompt = `[VAULT CONTEXT]\n${vd.content as string}\n\n${effectivePrompt}`
        messages.push({ id: `msg-${Date.now()}-vi`, content: `📚 Vault context injected (${((vd.content as string).length / 1000).toFixed(1)}k chars)` })
      }
    } catch (e) {
      console.warn('Vault injection failed:', e instanceof Error ? e.message : String(e))
    }
  }

  // 3. Notepad injection
  if (!agent.sessionId && agent.injectNotepad) {
    try {
      const np = await fetch(`/api/notepad?agentId=${encodeURIComponent(agent.id)}`)
      const npd = await np.json()
      if (npd.exists && npd.content) {
        const raw = npd.content as string
        const capped = raw.length > MAX_NOTEPAD_INJECTION_BYTES
          ? raw.slice(0, MAX_NOTEPAD_INJECTION_BYTES) + '\n...(truncated)'
          : raw
        effectivePrompt = `[AGENT MEMORY]\n${capped}\n\n${effectivePrompt}`
        messages.push({
          id: `msg-${Date.now()}-np`,
          content: `Notepad injected (${(raw.length / 1000).toFixed(1)}k chars${raw.length > MAX_NOTEPAD_INJECTION_BYTES ? ', truncated to 100k' : ''})`,
        })
      }
    } catch (e) {
      console.warn('Notepad injection failed:', e instanceof Error ? e.message : String(e))
    }
  }

  // 4. Magic keyword detection (last — outermost prefix, read first by model)
  const keywordMatches = detectKeywords(prompt)
  if (keywordMatches.length > 0) {
    const { modifiedPrompt, agentUpdates: kwUpdates } = applyKeywords(effectivePrompt, keywordMatches)
    effectivePrompt = modifiedPrompt
    Object.assign(agentUpdates, kwUpdates)
    messages.push({ id: `msg-${Date.now()}-kw`, content: `Keywords detected: ${keywordMatches.map(m => m.label).join(', ')}` })
  }

  return { effectivePrompt, messages, keywordMatches, agentUpdates }
}

// ── Worktree Creation ──────────────────────────────────────────────

export interface WorktreeResult {
  effectivePath: string
  worktreeUpdate?: { worktreePath: string; worktreeBranch: string }
}

export async function createWorktreeIfNeeded(
  agent: Pick<Agent, 'worktreePath' | 'path' | 'id'>,
): Promise<WorktreeResult> {
  let effectivePath = agent.worktreePath || agent.path
  if (!agent.worktreePath) {
    try {
      const res = await fetch('/api/worktree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, repoPath: agent.path }),
      })
      const wt = await res.json()
      if (wt.worktreePath) {
        effectivePath = wt.worktreePath
        return { effectivePath, worktreeUpdate: { worktreePath: wt.worktreePath, worktreeBranch: wt.branchName } }
      }
    } catch (e) {
      console.warn('Worktree creation failed:', e instanceof Error ? e.message : String(e))
    }
  }
  return { effectivePath }
}

// ── Auto-Iterate State Machine ──────────────────────────────────────

export interface IterState {
  mode: 'rating' | 'improving'
  round: number
}

export interface ResultHandlerInput {
  finalText: string
  msg: { cost?: number | null; inputTokens?: number | null; outputTokens?: number | null }
  prevCost: number
  prevTurns: number
  prevTokens: number
  budgetCap: number | null
  autoIterate: boolean
  iterateThreshold: number
  iterateMaxRounds: number
  iterState: IterState | null
  agentName: string
}

export interface ResultHandlerOutput {
  newCost: number
  statsUpdate: {
    sessionCost: number
    sessionTurns: number
    sessionTokens: number
  }
  budgetExceeded: boolean
  budgetMessage?: string
  nextIterState: IterState | null
  pendingPrompt: string | null
  iterMessage?: string
  notification?: { title: string; body: string }
  score?: number | null
}

export function handleResultMessage(input: ResultHandlerInput): ResultHandlerOutput {
  const { finalText, msg, prevCost, prevTurns, prevTokens, budgetCap, autoIterate, iterateThreshold, iterateMaxRounds, iterState, agentName } = input

  const addedTokens = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0)
  const newCost = prevCost + (msg.cost || 0)

  const statsUpdate = {
    sessionCost: newCost,
    sessionTurns: prevTurns + 1,
    sessionTokens: addedTokens > 0 ? prevTokens + addedTokens : prevTokens,
  }

  // Budget cap check
  const budgetExceeded = budgetCap != null && newCost >= budgetCap
  const budgetMessage = budgetExceeded
    ? `🚫 Budget cap $${budgetCap!.toFixed(2)} reached ($${newCost.toFixed(4)} used). Agent stopped. Reset session or raise cap to continue.`
    : undefined

  if (budgetExceeded) {
    return { newCost, statsUpdate, budgetExceeded, budgetMessage, nextIterState: null, pendingPrompt: null }
  }

  // Auto-iterate logic
  if (!autoIterate) {
    return {
      newCost, statsUpdate, budgetExceeded: false,
      nextIterState: null, pendingPrompt: null,
      notification: { title: `${agentName} finished`, body: finalText.slice(0, 100) + (finalText.length > 100 ? '...' : '') },
    }
  }

  if (iterState === null) {
    // First completion → kick off rating
    return {
      newCost, statsUpdate, budgetExceeded: false,
      nextIterState: { mode: 'rating', round: 1 },
      pendingPrompt: 'Rate your work from 0–100 and list specific improvements. Format: Score: X/100',
      iterMessage: '⟳ Auto-iterate: rating quality...',
      score: null,
    }
  }

  if (iterState.mode === 'rating') {
    const score = parseScore(finalText)
    if (score === null) {
      // Couldn't parse score — stop iterating
      return { newCost, statsUpdate, budgetExceeded: false, nextIterState: null, pendingPrompt: null }
    }
    if (score < iterateThreshold && iterState.round < iterateMaxRounds) {
      const nextRound = iterState.round + 1
      return {
        newCost, statsUpdate, budgetExceeded: false, score,
        nextIterState: { mode: 'improving', round: nextRound },
        pendingPrompt: `Your score was ${score}/100. Improve the specific areas you identified.`,
        iterMessage: `⟳ Auto-iterate: score ${score}/100 < ${iterateThreshold}. Improving (round ${nextRound}/${iterateMaxRounds})...`,
      }
    }
    // Score meets threshold or max rounds reached
    return {
      newCost, statsUpdate, budgetExceeded: false, score,
      nextIterState: null, pendingPrompt: null,
      iterMessage: `✓ Auto-iterate done. Final score: ${score}/100`,
      notification: { title: `${agentName} finished (${score}/100)`, body: finalText.slice(0, 100) },
    }
  }

  // mode === 'improving' → re-rate
  return {
    newCost, statsUpdate, budgetExceeded: false,
    nextIterState: { mode: 'rating', round: iterState.round },
    pendingPrompt: 'Rate your updated work from 0–100. Format: Score: X/100',
    iterMessage: '⟳ Auto-iterate: re-rating after improvements...',
  }
}
