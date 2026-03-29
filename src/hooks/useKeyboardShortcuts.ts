'use client'

import { useEffect } from 'react'

interface KeyboardShortcutHandlers {
  onEscape: () => void
  onRoadmap: () => void
  onQmChat: () => void
  onArrowDown?: () => void
  onArrowUp?: () => void
  onEnter?: () => void
  onCostDashboard?: () => void
}

export function useKeyboardShortcuts({ onEscape, onRoadmap, onQmChat, onArrowDown, onArrowUp, onEnter, onCostDashboard }: KeyboardShortcutHandlers): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip navigation keys when user is typing
      const tag = (e.target as HTMLElement)?.tagName
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA'

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
      if (e.key === 'c' && e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        onCostDashboard?.()
      }
      // Arrow keys + Enter for agent card navigation (skip when in inputs)
      if (!isInput) {
        if (e.key === 'ArrowDown') { e.preventDefault(); onArrowDown?.() }
        if (e.key === 'ArrowUp') { e.preventDefault(); onArrowUp?.() }
        if (e.key === 'Enter') { e.preventDefault(); onEnter?.() }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onEscape, onRoadmap, onQmChat, onArrowDown, onArrowUp, onEnter, onCostDashboard])
}
