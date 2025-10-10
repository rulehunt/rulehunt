// src/api/starred.ts
import { type StarredPattern, StarredResponse } from '../schema'

/**
 * Fetch a random starred pattern from the database.
 * Returns null if no starred patterns exist or on error.
 * Validates and parses response using shared Zod schema.
 *
 * @returns StarredPattern with ruleset and seed for exact reproduction, or null
 */
export async function fetchStarredPattern(): Promise<StarredPattern | null> {
  console.log('[fetchStarredPattern] 📤 Fetching random starred pattern...')

  try {
    const res = await fetch('/api/starred', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const responseText = await res.text()
    console.log('[fetchStarredPattern] 📥 Response:', {
      status: res.status,
      ok: res.ok,
      bodyPreview: responseText.substring(0, 200),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const json = JSON.parse(responseText)
    const data = StarredResponse.parse(json) // ✅ schema-validated

    if (data.ok && data.pattern) {
      console.log('[fetchStarredPattern] ✅ Success:', {
        rulesetName: data.pattern.ruleset_name,
        rulesetHex: data.pattern.ruleset_hex,
        seed: data.pattern.seed,
        seedType: data.pattern.seed_type,
      })
      return data.pattern
    }

    console.log('[fetchStarredPattern] ℹ️  No starred patterns found')
    return null
  } catch (err) {
    console.error('[fetchStarredPattern] ❌ Failed:', err)
    return null
  }
}
