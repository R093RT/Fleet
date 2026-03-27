'use client'

import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  label?: string
  compact?: boolean
  onDismiss?: () => void
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[Fleet] ErrorBoundary caught (${this.props.label ?? 'unknown'}):`, error, info.componentStack)
  }

  private handleRetry = () => {
    this.setState({ error: null })
  }

  override render() {
    if (!this.state.error) {
      return this.props.children
    }

    const { label, compact, onDismiss } = this.props
    const message = this.state.error.message || 'Unknown error'

    if (compact) {
      return (
        <div
          className="rounded-lg border p-4 text-center"
          style={{
            borderColor: 'rgba(212,168,67,0.15)',
            backgroundColor: 'rgba(212,168,67,0.04)',
          }}
        >
          <div className="text-xs text-white/40 mb-1">
            {label ? `${label} crashed` : 'Component crashed'}
          </div>
          <div
            className="text-xs font-mono mb-3 max-h-16 overflow-auto"
            style={{ color: '#d4a843', opacity: 0.7 }}
          >
            {message}
          </div>
          <button
            onClick={this.handleRetry}
            className="text-xs px-3 py-1 rounded-md transition-all"
            style={{
              backgroundColor: 'rgba(212,168,67,0.15)',
              color: '#d4a843',
              border: '1px solid rgba(212,168,67,0.25)',
            }}
          >
            Try Again
          </button>
        </div>
      )
    }

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onDismiss?.() }}
        onKeyDown={(e) => { if (e.key === 'Escape') onDismiss?.() }}
        tabIndex={-1}
        ref={(el) => el?.focus()}
      >
        <div
          className="rounded-xl border p-6 max-w-md w-full text-center"
          style={{
            borderColor: 'rgba(212,168,67,0.15)',
            backgroundColor: '#0f1117',
          }}
        >
          <div className="text-lg mb-2" style={{ color: '#d4a843' }}>
            Something went wrong
          </div>
          <div className="text-xs text-white/40 mb-1">
            {label ?? 'A component encountered an error'}
          </div>
          <div
            className="text-xs font-mono mb-4 p-2 rounded max-h-24 overflow-auto text-left"
            style={{
              backgroundColor: 'rgba(0,0,0,0.3)',
              color: 'rgba(255,255,255,0.5)',
            }}
          >
            {message}
          </div>
          <div className="flex items-center justify-center gap-2">
            <button
              onClick={this.handleRetry}
              className="text-xs px-4 py-1.5 rounded-md font-medium transition-all"
              style={{
                backgroundColor: 'rgba(212,168,67,0.15)',
                color: '#d4a843',
                border: '1px solid rgba(212,168,67,0.25)',
              }}
            >
              Try Again
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="text-xs px-4 py-1.5 rounded-md text-white/30 hover:text-white/60 transition-all"
              >
                Dismiss
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
