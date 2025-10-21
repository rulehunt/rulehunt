import { z } from 'zod'

const ShareResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

/**
 * Track a share button click for a run
 */
export async function trackShare(runId: string): Promise<void> {
  try {
    const response = await fetch('/api/share', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ runId }),
    })

    const data = await response.json()
    const result = ShareResponse.parse(data)

    if (!result.ok) {
      console.error('[share] Failed to track share:', result.error)
    }
  } catch (error) {
    // Don't throw - we don't want tracking failures to break the share functionality
    console.error('[share] Error tracking share:', error)
  }
}
