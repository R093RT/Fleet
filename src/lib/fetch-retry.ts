interface FetchRetryOptions {
  retries?: number
  backoffMs?: number
}

/** Fetch with automatic retry on network errors and 5xx responses. */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  opts: FetchRetryOptions = {},
): Promise<Response> {
  const { retries = 2, backoffMs = 500 } = opts
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.ok || res.status < 500 || attempt === retries) return res
    } catch (e) {
      lastError = e
      if (attempt === retries) throw lastError
    }
    await new Promise(resolve => setTimeout(resolve, backoffMs * (attempt + 1)))
  }

  throw lastError
}
