/**
 * Validates and builds a safe localhost URL from port + path inputs.
 * Returns null if the resulting URL would point anywhere other than localhost.
 */
export function buildSafeLocalhostUrl(port: string, urlPath: string): string | null {
  try {
    const candidate = new URL(`http://localhost:${port}${urlPath}`)
    if (candidate.protocol !== 'http:') return null
    if (candidate.hostname !== 'localhost' && candidate.hostname !== '127.0.0.1') return null
    return candidate.href
  } catch {
    return null
  }
}
