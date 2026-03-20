'use client'

export function CompassRose({ className = '', size = 200 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
      <circle cx="50" cy="50" r="35" stroke="currentColor" strokeWidth="0.3" opacity="0.2" />
      {/* N/S/E/W points */}
      <polygon points="50,5 47,40 53,40" fill="currentColor" opacity="0.4" />
      <polygon points="50,95 47,60 53,60" fill="currentColor" opacity="0.2" />
      <polygon points="95,50 60,47 60,53" fill="currentColor" opacity="0.2" />
      <polygon points="5,50 40,47 40,53" fill="currentColor" opacity="0.2" />
      {/* Diagonal points */}
      <polygon points="82,18 58,42 62,46" fill="currentColor" opacity="0.15" />
      <polygon points="18,82 42,58 46,62" fill="currentColor" opacity="0.15" />
      <polygon points="82,82 58,58 62,54" fill="currentColor" opacity="0.15" />
      <polygon points="18,18 42,42 38,46" fill="currentColor" opacity="0.15" />
      {/* Center circle */}
      <circle cx="50" cy="50" r="3" fill="currentColor" opacity="0.3" />
      {/* Cardinal letters */}
      <text x="50" y="16" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.4" fontFamily="Pirata One">N</text>
      <text x="50" y="90" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.3" fontFamily="Pirata One">S</text>
      <text x="87" y="52" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.3" fontFamily="Pirata One">E</text>
      <text x="13" y="52" textAnchor="middle" fontSize="5" fill="currentColor" opacity="0.3" fontFamily="Pirata One">W</text>
    </svg>
  )
}

export function AnchorIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="5" r="3" />
      <line x1="12" y1="8" x2="12" y2="22" />
      <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
    </svg>
  )
}

export function ShipWheelIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="8" />
      {/* Spokes */}
      <line x1="12" y1="1" x2="12" y2="4" />
      <line x1="12" y1="20" x2="12" y2="23" />
      <line x1="1" y1="12" x2="4" y2="12" />
      <line x1="20" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="4.22" x2="6.34" y2="6.34" />
      <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
      <line x1="4.22" y1="19.78" x2="6.34" y2="17.66" />
      <line x1="17.66" y1="6.34" x2="19.78" y2="4.22" />
      {/* Handle knobs */}
      <circle cx="12" cy="1.5" r="1" fill="currentColor" />
      <circle cx="12" cy="22.5" r="1" fill="currentColor" />
      <circle cx="1.5" cy="12" r="1" fill="currentColor" />
      <circle cx="22.5" cy="12" r="1" fill="currentColor" />
    </svg>
  )
}

export function SkullIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2C7 2 3 6 3 11c0 3.5 2 6 5 7v2h8v-2c3-1 5-3.5 5-7 0-5-4-9-9-9z" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <circle cx="15" cy="10" r="1.5" fill="currentColor" />
      <path d="M10 16v2M14 16v2" />
      <path d="M9 14h6" />
    </svg>
  )
}

export function SpyglassIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="14" cy="10" r="6" />
      <circle cx="14" cy="10" r="3" />
      <line x1="3" y1="21" x2="9.5" y2="14.5" />
      <line x1="3" y1="21" x2="5" y2="19" strokeWidth="3" />
    </svg>
  )
}

export function CrossedSwordsIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="3" y1="3" x2="21" y2="21" />
      <line x1="21" y1="3" x2="3" y2="21" />
      <line x1="3" y1="3" x2="7" y2="3" />
      <line x1="3" y1="3" x2="3" y2="7" />
      <line x1="21" y1="3" x2="17" y2="3" />
      <line x1="21" y1="3" x2="21" y2="7" />
      <line x1="3" y1="21" x2="7" y2="21" />
      <line x1="3" y1="21" x2="3" y2="17" />
      <line x1="21" y1="21" x2="17" y2="21" />
      <line x1="21" y1="21" x2="21" y2="17" />
    </svg>
  )
}

export function TreasureChestIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="11" width="20" height="10" rx="1" />
      <path d="M2 11c0-4 4-7 10-7s10 3 10 7" />
      <line x1="12" y1="11" x2="12" y2="21" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" />
      <line x1="2" y1="11" x2="22" y2="11" />
    </svg>
  )
}

export function FlagIcon({ size = 16, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="4" y1="2" x2="4" y2="22" />
      <path d="M4 2l16 6-16 6" fill="currentColor" opacity="0.2" />
      <path d="M4 2l16 6-16 6" />
    </svg>
  )
}
