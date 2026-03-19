import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Fleet',
  description: 'Orchestration dashboard for Claude Code agents',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
