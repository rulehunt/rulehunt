/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { FavoritesResponse } from '../../src/schema'
import { handleApiError, jsonResponse } from '../utils/api-helpers'

/**
 * GET /api/favorites
 *
 * Fetches all starred patterns from the database with pagination.
 * Returns { ok: true, favorites: [...], count: N, hasMore: boolean }
 *
 * Query parameters:
 * - userId: string (default: 'anonymous')
 * - limit: number (default: 50, max: 100)
 * - offset: number (default: 0)
 */
export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  try {
    const url = new URL(ctx.request.url)
    const userId = url.searchParams.get('userId') || 'anonymous'
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') || '50'),
      100,
    )
    const offset = parseInt(url.searchParams.get('offset') || '0')

    // --- Query for starred patterns with pagination ---
    const query = `
      SELECT
        ruleset_name,
        ruleset_hex,
        seed,
        seed_type,
        seed_percentage
      FROM runs
      WHERE user_id = ? AND is_starred = 1
      ORDER BY submitted_at DESC
      LIMIT ? OFFSET ?
    `

    const { results } = await ctx.env.DB.prepare(query)
      .bind(userId, limit + 1, offset) // Fetch one extra to check if there are more
      .all()

    // Check if there are more results
    const hasMore = results.length > limit
    const favorites = hasMore ? results.slice(0, limit) : results

    // Ensure seed_percentage is null if not provided (compatibility)
    for (const favorite of favorites) {
      if (favorite.seed_percentage === undefined) {
        favorite.seed_percentage = null
      }
    }

    const response = FavoritesResponse.parse({
      ok: true,
      favorites,
      count: favorites.length,
      hasMore,
    })

    return jsonResponse(response)
  } catch (error) {
    return handleApiError(error, 'favorites')
  }
}
