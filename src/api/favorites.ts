// src/api/favorites.ts
import { type FavoritesResponse, FavoritesResponse as FavoritesResponseSchema } from '../schema'

/**
 * Fetch all starred patterns from the database with pagination.
 * Returns null on error.
 * Validates and parses response using shared Zod schema.
 *
 * @param userId - User ID (default: 'anonymous')
 * @param limit - Number of results to fetch (default: 50, max: 100)
 * @param offset - Pagination offset (default: 0)
 * @returns FavoritesResponse with array of patterns, count, and hasMore flag, or null
 */
export async function fetchFavorites(
  userId: string = 'anonymous',
  limit: number = 50,
  offset: number = 0,
): Promise<FavoritesResponse | null> {
  console.log('[fetchFavorites] 📤 Fetching favorites...', { userId, limit, offset })

  try {
    const params = new URLSearchParams({
      userId,
      limit: String(limit),
      offset: String(offset),
    })

    const res = await fetch(`/api/favorites?${params}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })

    const responseText = await res.text()
    console.log('[fetchFavorites] 📥 Response:', {
      status: res.status,
      ok: res.ok,
      bodyPreview: responseText.substring(0, 200),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`)
    }

    const json = JSON.parse(responseText)
    const data = FavoritesResponseSchema.parse(json) // ✅ schema-validated

    if (data.ok) {
      console.log('[fetchFavorites] ✅ Success:', {
        count: data.count,
        hasMore: data.hasMore,
      })
      return data
    }

    console.log('[fetchFavorites] ℹ️  Request failed')
    return null
  } catch (err) {
    console.error('[fetchFavorites] ❌ Failed:', err)
    return null
  }
}
