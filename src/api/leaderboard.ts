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
  try {
    const res = await fetch(`/api/leaderboard?limit=${limit}`)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const json = await res.json()
    const data = LeaderboardResponse.parse(json)

    if (!data.ok) {
      throw new Error('Unexpected response shape')
    }

    console.log(`[fetchLeaderboard] ✅ fetched ${data.results.length} entries`)
    return data.results
  } catch (err) {
    console.error('[fetchLeaderboard] ❌ failed', err)
    return []
  }
}
