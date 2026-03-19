'use client'

import { useState, useEffect } from 'react'
import { QRCodeSVG } from 'qrcode.react'

export function QrModal({ onClose }: { onClose: () => void }) {
  // undefined = loading, null = not found, string = IP address
  const [ip, setIp] = useState<string | null | undefined>(undefined)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/local-ip')
      .then(r => r.json())
      .then((data: { ip: string | null }) => setIp(data.ip))
      .catch(() => setIp(null))
  }, [])

  const url = ip ? `http://${ip}:4000` : null

  const copyUrl = () => {
    if (!url) return
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}>
      <div className="rounded-xl border border-white/10 p-6 w-80 space-y-4"
        style={{ backgroundColor: '#0f1117' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white/80">Open on mobile</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/70 text-lg leading-none">×</button>
        </div>

        {/* QR / loading / error state */}
        {ip === undefined ? (
          <div className="flex justify-center items-center h-[212px] rounded-lg bg-white/5">
            <span className="text-white/20 text-sm animate-pulse">Detecting LAN IP…</span>
          </div>
        ) : url ? (
          <div className="flex justify-center p-4 rounded-lg bg-white">
            <QRCodeSVG value={url} size={180} />
          </div>
        ) : (
          <div className="flex flex-col justify-center items-center h-[212px] rounded-lg bg-white/5 gap-2">
            <span className="text-2xl">📡</span>
            <span className="text-amber-400/70 text-sm font-medium">No LAN IP detected</span>
            <span className="text-white/30 text-xs text-center px-4">
              Connect to a network, then reopen this modal
            </span>
          </div>
        )}

        {url && (
          <div className="space-y-1.5">
            <p className="text-xs text-white/40 text-center">
              Scan from any device on the same network
            </p>
            <button onClick={copyUrl}
              className="w-full text-xs py-1.5 rounded border border-white/10 text-white/50 hover:text-white/80 hover:border-white/20 transition-all font-mono truncate"
              title={url}>
              {copied ? '✓ Copied!' : url}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
