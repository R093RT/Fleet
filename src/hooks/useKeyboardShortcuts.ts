'use client'

import { useEffect } from 'react'

interface KeyboardShortcutHandlers {
  onEscape: () => void
  onRoadmap: () => void
  onQmChat: () => void
}

export function useKeyboardShortcuts({ onEscape, onRoadmap, onQmChat }: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape()
      }
      if (e.key === 'r' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        onRoadmap()
      }
      if (e.key === 'q' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        onQmChat()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, onRoadmap, onQmChat])
}
