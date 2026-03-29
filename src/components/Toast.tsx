'use client'

import { useEffect } from 'react'
import { useToastStore } from '@/lib/toast-store'

const BORDER_COLORS: Record<string, string> = {
  success: '#4ade80',
  error: '#f87171',
  warning: '#fbbf24',
  info: '#60a5fa',
}

function ToastItem({ id, message, type, duration }: { id: string; message: string; type: string; duration: number }) {
  const removeToast = useToastStore((s) => s.removeToast)

  useEffect(() => {
    const t = setTimeout(() => removeToast(id), duration)
    return () => clearTimeout(t)
  }, [id, duration, removeToast])

  return (
    <div
      onClick={() => removeToast(id)}
      className="px-4 py-2.5 rounded-lg bg-[#12100e] border border-white/10 text-xs text-white/70 font-mono shadow-lg cursor-pointer hover:bg-white/[0.06] transition-all animate-fade-in"
      style={{ borderLeftWidth: 3, borderLeftColor: BORDER_COLORS[type] ?? BORDER_COLORS.info }}
    >
      {message}
    </div>
  )
}

export function ToastProvider() {
  const toasts = useToastStore((s) => s.toasts)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-xs">
      {toasts.map((t) => (
        <ToastItem key={t.id} {...t} />
      ))}
    </div>
  )
}
