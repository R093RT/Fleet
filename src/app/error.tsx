'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#08090d', fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div
        className="rounded-xl border p-8 max-w-lg w-full text-center"
        style={{
          borderColor: 'rgba(212,168,67,0.15)',
          backgroundColor: '#0f1117',
        }}
      >
        <div className="text-2xl mb-3" style={{ color: '#d4a843' }}>
          Fleet Error
        </div>
        <div className="text-xs mb-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
          The dashboard encountered an unexpected error.
        </div>
        <div
          className="text-xs font-mono p-3 rounded mb-6 text-left max-h-32 overflow-auto"
          style={{
            backgroundColor: 'rgba(0,0,0,0.4)',
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {error.message || 'Unknown error'}
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="text-sm px-6 py-2 rounded-md font-medium transition-all"
            style={{
              backgroundColor: 'rgba(212,168,67,0.15)',
              color: '#d4a843',
              border: '1px solid rgba(212,168,67,0.25)',
            }}
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.reload()}
            className="text-xs text-white/30 hover:text-white/50 transition-all"
          >
            Reload Page
          </button>
        </div>
      </div>
    </div>
  )
}
