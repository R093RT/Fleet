import { create } from 'zustand'

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration: number
}

interface ToastStore {
  toasts: Toast[]
  addToast: (message: string, type?: ToastType, duration?: number) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info', duration = 3000) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
    set((s) => ({ toasts: [...s.toasts.slice(-4), { id, message, type, duration }] }))
  },
  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
}))

export function useToast() {
  const addToast = useToastStore((s) => s.addToast)
  return {
    toast: addToast,
    success: (msg: string) => addToast(msg, 'success'),
    error: (msg: string) => addToast(msg, 'error'),
    warning: (msg: string) => addToast(msg, 'warning'),
    info: (msg: string) => addToast(msg, 'info'),
  }
}
