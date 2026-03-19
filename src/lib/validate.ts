import path from 'path'
import { z } from 'zod'

/**
 * Shared validation primitives for API route schemas.
 *
 * Safe patterns prevent shell injection and path traversal by
 * restricting which characters are allowed in user-supplied values
 * that eventually reach child_process calls or filesystem paths.
 */

/**
 * Absolute filesystem path.
 * Rejects empty strings and relative paths (including traversal attempts like "../foo").
 */
export const AbsolutePath = z
  .string()
  .min(1)
  .refine((p) => path.isAbsolute(p), { message: 'Path must be absolute' })

/** Agent IDs: alphanumeric, hyphens, underscores only. */
export const SafeId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid ID — use alphanumeric characters, hyphens, or underscores')

/** Session IDs returned by Claude CLI (alphanumeric, hyphens, underscores, slashes). */
export const SafeSessionId = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9_/-]+$/, 'Invalid session ID format')

/**
 * Tool names accepted by the Claude CLI --allowedTools flag.
 * Examples: "Read", "Write", "Bash(npm run *)"
 * Rejects anything containing shell metacharacters.
 */
export const SafeTool = z
  .string()
  .min(1)
  .max(200)
  .regex(
    /^[A-Za-z_][A-Za-z0-9_*() .:/-]*$/,
    'Invalid tool name — unexpected characters'
  )
