'use client'

import { useEffect } from 'react'

interface KeyboardShortcutHandlers {
  onEscape: () => void
  onRoadmap: () => void
}

export function useKeyboardShortcuts({ onEscape, onRoadmap }: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape()
      }
      if (e.key === 'r' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        onRoadmap()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, onRoadmap])
}
