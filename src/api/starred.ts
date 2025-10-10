// src/api/starred.ts
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Schema: matches the Cloudflare Worker JSON response
// ---------------------------------------------------------------------------
export const StarredPattern = z.object({
  ruleset_name: z.string(),
  ruleset_hex: z.string(),
  seed: z.number(),
  seed_type: z.enum(['center', 'random', 'patch']),
  seed_percentage: z.number().nullable(),
})

export type StarredPattern = z.infer<typeof StarredPattern>

export const StarredResponse = z.object({
  ok: z.boolean(),
  pattern: StarredPattern.nullable(),
})

export type StarredResponse = z.infer<typeof StarredResponse>

// ---------------------------------------------------------------------------
// API: fetchStarredPattern
// ---------------------------------------------------------------------------
/**
 * Frontend helper to fetch a random starred pattern.
 * Returns null if no starred patterns exist.
 */
export async function fetchStarredPattern(): Promise<StarredPattern | null> {
  try {
    console.log('[fetchStarredPattern] 📤 Fetching starred pattern...')

    const res = await fetch('/api/starred', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const responseText = await res.text()
    console.log('[fetchStarredPattern] 📥 Response:', {
      status: res.status,
      ok: res.ok,
      body: responseText,
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${responseText}`)
    }

    const json = JSON.parse(responseText)
    const result = StarredResponse.parse(json) // ✅ schema-validated

    if (result.ok && result.pattern) {
      console.log(
        '[fetchStarredPattern] ✅ Success:',
        result.pattern.ruleset_name,
      )
      return result.pattern
    }

    console.log('[fetchStarredPattern] ℹ️  No starred patterns found')
    return null
  } catch (err) {
    console.error('[fetchStarredPattern] ❌ Failed:', err)
    return null
  }
}
