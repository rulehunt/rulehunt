// src/api/statistics.ts
import { type StatisticsData, StatisticsResponse } from '../schema'

// ---------------------------------------------------------------------------
// API: fetchStatistics
// ---------------------------------------------------------------------------
/**
 * Fetch database statistics from the backend.
 * Validates and parses response using shared Zod schema.
 *
 * Returns StatisticsData on success, null on failure.
 */
export async function fetchStatistics(): Promise<StatisticsData | null> {
  console.log('[fetchStatistics] 📤 Requesting statistics')

  try {
    const res = await fetch('/api/statistics')

    const responseText = await res.text()
    console.log('[fetchStatistics] 📥 Response:', {
      status: res.status,
      ok: res.ok,
      bodyPreview: responseText.substring(0, 500),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const json = JSON.parse(responseText)
    console.log('[fetchStatistics] 🔍 Parsed JSON:', {
      ok: json.ok,
      hasStats: !!json.stats,
      error: json.error,
    })

    const data = StatisticsResponse.parse(json)

    if (!data.ok || !data.stats) {
      console.warn('[fetchStatistics] ⚠️  No statistics data:', data.error)
      return null
    }

    console.log('[fetchStatistics] ✅ Fetched statistics:', {
      totalRuns: data.stats.total_runs,
      totalSteps: data.stats.total_steps,
      totalStarred: data.stats.total_starred,
      uniqueRulesets: data.stats.unique_rulesets,
    })

    return data.stats
  } catch (err) {
    console.error('[fetchStatistics] ❌ Failed:', err)
    return null
  }
}
