import { z } from 'zod'

const StatsViewResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

/**
 * Track a stats button click for a run
 */
export async function trackStatsView(runId: string): Promise<void> {
  try {
    const response = await fetch('/api/stats-view', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ runId }),
    })

    const data = await response.json()
    const result = StatsViewResponse.parse(data)

    if (!result.ok) {
      console.error('[stats-view] Failed to track stats view:', result.error)
    }
  } catch (error) {
    // Don't throw - we don't want tracking failures to break the stats functionality
    console.error('[stats-view] Error tracking stats view:', error)
  }
}
