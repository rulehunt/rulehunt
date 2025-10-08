// src/api/leaderboard.ts
import { type LeaderboardEntry, LeaderboardResponse } from '../schema'

/**
 * Fetch leaderboard results from the backend.
 * Validates and parses response using shared Zod schema.
 *
 * @param limit Maximum number of entries to fetch (default: 10)
 */
export async function fetchLeaderboard(
  limit = 10,
): Promise<LeaderboardEntry[]> {
  console.log(`[fetchLeaderboard] 📤 Requesting limit=${limit}`)

  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`)

    const responseText = await res.text()
    console.log('[fetchLeaderboard] 📥 Response:', {
      status: res.status,
      ok: res.ok,
      bodyPreview: responseText.substring(0, 500),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const json = JSON.parse(responseText)
    console.log('[fetchLeaderboard] 🔍 Parsed JSON:', {
      ok: json.ok,
      resultsCount: json.results?.length,
      firstResult: json.results?.[0],
    })

    const data = LeaderboardResponse.parse(json)

    if (!data.ok) {
      throw new Error('Unexpected response shape')
    }

    console.log(`[fetchLeaderboard] ✅ Fetched ${data.results.length} entries`)
    return data.results
  } catch (err) {
    console.error('[fetchLeaderboard] ❌ Failed:', err)
    return []
  }
}
