export function formatTime(ts: number | null): string {
  if (!ts) return '—'
  const diff = Math.floor((Date.now() - ts) / 60000)
  if (diff < 1) return 'just now'
  if (diff < 60) return `${diff}m ago`
  if (diff < 1440) return `${Math.floor(diff / 60)}h ago`
  return new Date(ts).toLocaleDateString()
}
