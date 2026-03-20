'use client'

import { useState, useRef, useEffect } from 'react'

interface SelectOption {
  value: string
  label: string
}

interface SelectProps {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  size?: 'sm' | 'md'
  className?: string
}

export function Select({ value, onChange, options, placeholder, size = 'md', className = '' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open])

  const selected = options.find(o => o.value === value)
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'
  const py = size === 'sm' ? 'py-1' : 'py-1.5'

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 w-full ${textSize} bg-white/[0.04] border border-white/[0.08] rounded-md px-3 ${py} text-white/80 outline-none hover:border-white/[0.15] focus:border-white/20 transition-colors duration-150`}
      >
        <span className={selected ? '' : 'text-white/25'}>
          {selected?.label ?? placeholder ?? 'Select...'}
        </span>
        <span className={`text-white/20 text-[10px] transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[140px] bg-surface-overlay border border-white/[0.10] rounded-md shadow-lg shadow-black/40 animate-slide-down overflow-hidden">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left ${textSize} px-3 ${py} transition-colors duration-100 ${
                o.value === value
                  ? 'bg-white/[0.08] text-white/90'
                  : 'text-white/60 hover:bg-white/[0.06] hover:text-white/90'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
