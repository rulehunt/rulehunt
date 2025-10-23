// src/api/rating.ts
/**
 * Submit or update a pattern rating
 */
export async function submitRating(params: {
  runHash: string
  userId: string
  rating: number
  rulesetHex: string
  seed: number
  generation: number
}): Promise<{
  ok: boolean
  rating?: number
  stats?: {
    rating_count: number
    avg_rating: number
    min_rating: number
    max_rating: number
    high_ratings_count: number
  }
  error?: string
}> {
  try {
    const response = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    return await response.json()
  } catch (err) {
    console.error('[submitRating] Error:', err)
    return { ok: false, error: 'Failed to submit rating' }
  }
}

/**
 * Get rating statistics for a pattern
 */
export async function getRatingStats(
  runHash: string,
  userId?: string,
): Promise<{
  ok: boolean
  stats?: {
    rating_count: number
    avg_rating: number
    min_rating: number
    max_rating: number
    high_ratings_count: number
  }
  userRating?: number | null
  userRatedAt?: string | null
  error?: string
}> {
  try {
    const params = new URLSearchParams({ runHash })
    if (userId) params.append('userId', userId)

    const response = await fetch(`/api/rate?${params}`)
    return await response.json()
  } catch (err) {
    console.error('[getRatingStats] Error:', err)
    return { ok: false, error: 'Failed to fetch rating stats' }
  }
}
