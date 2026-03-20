import type { ReactNode } from 'react'
import { useStore } from '@/lib/store'

export function usePirateMode(): boolean {
  return useStore(s => s.pirateMode)
}

export function usePirateClass(): string {
  return useStore(s => s.pirateMode) ? 'font-pirate' : ''
}

export function usePirateText(): <T extends ReactNode>(pirate: T, normal: T) => T {
  const p = useStore(s => s.pirateMode)
  return <T extends ReactNode>(pirate: T, normal: T) => p ? pirate : normal
}
