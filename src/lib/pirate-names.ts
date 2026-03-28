export interface PirateName {
  name: string
  icon: string
}

export const PIRATE_NAMES: PirateName[] = [
  { name: 'Blackbeard', icon: '🏴‍☠️' },
  { name: 'Anne Bonny', icon: '⚔️' },
  { name: 'Calico Jack', icon: '🦜' },
  { name: 'Black Bart', icon: '📊' },
  { name: 'Henry Morgan', icon: '💣' },
  { name: 'Grace O\'Malley', icon: '👑' },
  { name: 'Mary Read', icon: '🗡️' },
  { name: 'Jean Lafitte', icon: '🔧' },
  { name: 'Ching Shih', icon: '🐉' },
  { name: 'Stede Bonnet', icon: '📚' },
  { name: 'Black Sam', icon: '⛵' },
  { name: 'Charles Vane', icon: '🔥' },
  { name: 'Barbarossa', icon: '🌊' },
  { name: 'Edward Low', icon: '☠️' },
  { name: 'Long John Silver', icon: '🦿' },
  // Extended pool
  { name: 'Captain Kidd', icon: '🗝️' },
  { name: 'Francis Drake', icon: '🧭' },
  { name: 'Jack Sparrow', icon: '🍾' },
  { name: 'Davy Jones', icon: '🐙' },
  { name: 'Red Beard', icon: '🔴' },
  { name: 'Madam Cheng', icon: '🎎' },
  { name: 'Olivier Levasseur', icon: '💎' },
  { name: 'Samuel Mason', icon: '🪓' },
  { name: 'Rachel Wall', icon: '🌙' },
  { name: 'Sadie the Goat', icon: '🐐' },
]

export const DOMAIN_TO_ROLE: Record<string, string> = {
  frontend: 'Navigator',
  backend: 'Bosun',
  testing: 'Lookout',
  devops: 'Quartermaster',
  database: 'Treasure Master',
  docs: 'Cartographer',
  security: 'Armorer',
  performance: 'Sail Master',
  general: 'Deckhand',
}

export const PIRATE_COLORS = [
  '#8b1a1a',
  '#2563eb',
  '#059669',
  '#7c3aed',
  '#d97706',
  '#0d9488',
  '#e11d48',
  '#06b6d4',
  '#84cc16',
  '#f97316',
  '#8b5cf6',
  '#ec4899',
]

export interface Workstream {
  name: string
  description: string
  tasks: string[]
  complexity: number
  dependencies: string[]
  domain: string
  territory: string[]
}

export interface PirateAssignment extends Workstream {
  pirateName: string
  pirateIcon: string
  pirateRole: string
  pirateColor: string
  repoPath?: string
}

export function assignPirateIdentities(workstreams: Workstream[]): PirateAssignment[] {
  const shuffled = [...PIRATE_NAMES].sort(() => Math.random() - 0.5)
  return workstreams.map((ws, i) => ({
    ...ws,
    pirateName: shuffled[i % shuffled.length]!.name,
    pirateIcon: shuffled[i % shuffled.length]!.icon,
    pirateRole: DOMAIN_TO_ROLE[ws.domain] ?? 'Deckhand',
    pirateColor: PIRATE_COLORS[i % PIRATE_COLORS.length]!,
  }))
}
