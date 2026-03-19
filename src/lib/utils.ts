export const parseScore = (text: string): number | null => {
  const m =
    /(?:score|rating)[:\s]+(\d{1,3})\s*\/\s*100/i.exec(text) ||
    /\b(\d{1,3})\s*\/\s*100\b/.exec(text)
  if (!m) return null
  const n = parseInt(m[1] ?? '0')
  return n >= 0 && n <= 100 ? n : null
}

export function formatTime(ts: number | null): string {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return new Date(ts).toLocaleDateString()
}
