'use client'

import { usePirateMode } from '@/hooks/usePirateMode'

export const PIRATE_DICTIONARY: Record<string, string> = {
  // Status
  'Anchored': 'Idle',
  'Sailing': 'Running',
  'Awaiting Orders': 'Needs Input',
  'Scouting': 'Reviewing',
  'Docked': 'Done',
  'Shipwrecked': 'Error',
  // UI elements
  'Treasure Map': 'Project Roadmap',
  'Ship-to-Ship': 'Inter-agent Signals',
  'Standing Orders': 'Automated Reactions',
  'Recruit': 'Add Agent',
  'Scout': 'Discover Running Processes',
  'Treasure Chest': 'Budget',
  'Plunder Rating': 'Quality Score (0-100)',
  'Keep Sailing': 'Auto-iterate Until Threshold',
  'Fire!': 'Send Prompt',
  'All Stop!': 'Stop Agent',
  'Scuttle': 'Kill Process',
  'Full Crew': 'All Agents',
  'At Sea': 'Running Agents',
  'Set Sail': 'Launch All Agents',
  'Chart the Course': 'Analyze Roadmap',
  'Crew Manifest': 'Agent List',
  'Morale': 'Average Quality Score',
  'Treasure Spent': 'API Cost',
  'Loot': 'Git Commits',
  // Roles
  'Navigator': 'Frontend/UI Developer',
  'Bosun': 'Backend/API Developer',
  'Lookout': 'QA/Testing',
  'Quartermaster': 'DevOps/Infrastructure',
  'Treasure Master': 'Database Engineer',
  'Cartographer': 'Documentation Writer',
  'Armorer': 'Security Engineer',
  'Sail Master': 'Performance Engineer',
  'Deckhand': 'General Purpose',
  // Misc
  "Captain's Quarters": 'Dashboard',
  'Inject Treasure Map': 'Include roadmap in first prompt',
  'Pirate': 'Agent',
  'Spyglass': 'Remote Access / Mobile View',
}

export function PirateTerm({ pirate, real, className }: {
  pirate: string
  real: string
  className?: string
}) {
  return (
    <span title={real} className={`cursor-help border-b border-dotted border-white/10 ${className ?? ''}`}>
      {pirate}
    </span>
  )
}

/** Shorthand: looks up the real meaning from PIRATE_DICTIONARY.
 *  When pirateMode is off, renders the normal/real text directly. */
export function PT({ k, className }: { k: string; className?: string }) {
  const pirate = usePirateMode()
  const real = PIRATE_DICTIONARY[k] ?? k
  if (!pirate) return <span className={className}>{real}</span>
  return <PirateTerm pirate={k} real={real} className={className} />
}
