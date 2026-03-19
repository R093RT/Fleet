import { NextResponse } from 'next/server'
import os from 'os'

export async function GET() {
  const ifaces = os.networkInterfaces()
  let ip: string | null = null

  for (const name of Object.keys(ifaces)) {
    const addrs = ifaces[name]
    if (!addrs) continue
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) {
        ip = addr.address
        break
      }
    }
    if (ip) break
  }

  return NextResponse.json({ ip })
}
