// src/api/rating.ts
import { showErrorNotice } from '../components/shared/errorNotice'

export interface RatingRequestOptions {
  /** Show a user-facing notice when the request fails (default: true). */
  notifyOnError?: boolean
}

const SUBMIT_NOTICE_KEY = 'submit-rating'
const STATS_NOTICE_KEY = 'rating-stats'

export interface SubmitRatingParams {
  runHash: string
  userId: string
  rating: number
  rulesetHex: string
  seed: number
  generation: number
}

/**
 * Submit or update a pattern rating
 */
export async function submitRating(
  params: SubmitRatingParams,
  options: RatingRequestOptions = {},
): Promise<{
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
  const { notifyOnError = true } = options

  try {
    const response = await fetch('/api/rate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    return await response.json()
  } catch (err) {
    console.error('[submitRating] Error:', err)
    if (notifyOnError) {
      showErrorNotice({
        key: SUBMIT_NOTICE_KEY,
        message: "Couldn't submit your rating",
        detail:
          'Your rating was not recorded. Check your connection and retry.',
        action: {
          label: 'Retry',
          onClick: async () => {
            // A failed retry re-renders this same notice (same key).
            const result = await submitRating(params, options)
            if (result.ok) {
              showErrorNotice({
                key: SUBMIT_NOTICE_KEY,
                tone: 'success',
                message: 'Rating submitted',
                autoDismissMs: 4000,
              })
            }
          },
        },
      })
    }
    return { ok: false, error: 'Failed to submit rating' }
  }
}

/**
 * Get rating statistics for a pattern
 */
export async function getRatingStats(
  runHash: string,
  userId?: string,
  options: RatingRequestOptions = {},
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
  const { notifyOnError = true } = options

  try {
    const params = new URLSearchParams({ runHash })
    if (userId) params.append('userId', userId)

    const response = await fetch(`/api/rate?${params}`)
    return await response.json()
  } catch (err) {
    console.error('[getRatingStats] Error:', err)
    if (notifyOnError) {
      showErrorNotice({
        key: STATS_NOTICE_KEY,
        message: "Couldn't load ratings",
        detail: 'Rating scores are unavailable right now.',
        autoDismissMs: 8000,
      })
    }
    return { ok: false, error: 'Failed to fetch rating stats' }
  }
}
