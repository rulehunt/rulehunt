/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { jsonResponse } from '../utils/api-helpers'

// ========================================================================
// Schema Validation
// ========================================================================

const RatingSubmission = z.object({
  runHash: z.string().min(1, 'Run hash is required'),
  userId: z.string().min(1, 'User ID is required'),
  rating: z.number().int().min(1).max(5),
  rulesetHex: z.string().min(1, 'Ruleset hex is required'),
  seed: z.number().int(),
  generation: z.number().int().min(0),
})

// ========================================================================
// POST /api/rate
// Submit or update a pattern rating
// ========================================================================

export const onRequestPost = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  try {
    // --- Parse & validate request ---
    const body = await ctx.request.json().catch(() => null)
    if (!body) {
      return jsonResponse(
        { ok: false, error: 'Invalid JSON in request body' },
        400,
      )
    }

    const data = RatingSubmission.parse(body)

    // --- Insert or update rating in D1 ---
    const stmt = ctx.env.DB.prepare(`
      INSERT INTO pattern_ratings (
        run_hash,
        user_id,
        rating,
        ruleset_hex,
        seed,
        generation
      )
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(run_hash, user_id)
      DO UPDATE SET
        rating = excluded.rating,
        rated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
    `)

    await stmt
      .bind(
        data.runHash,
        data.userId,
        data.rating,
        data.rulesetHex,
        data.seed,
        data.generation,
      )
      .run()

    // --- Fetch updated rating statistics ---
    const statsStmt = ctx.env.DB.prepare(`
      SELECT
        rating_count,
        avg_rating,
        min_rating,
        max_rating,
        high_ratings_count
      FROM pattern_rating_stats
      WHERE run_hash = ?
    `)

    const stats = await statsStmt.bind(data.runHash).first()

    return jsonResponse({
      ok: true,
      rating: data.rating,
      stats: stats || {
        rating_count: 0,
        avg_rating: 0,
        min_rating: 0,
        max_rating: 0,
        high_ratings_count: 0,
      },
    })
  } catch (err) {
    console.error('[/api/rate] Error:', err)

    if (err instanceof z.ZodError) {
      return jsonResponse(
        { ok: false, error: 'Invalid rating data', details: err.issues },
        400,
      )
    }

    return jsonResponse({ ok: false, error: 'Internal server error' }, 500)
  }
}

// ========================================================================
// GET /api/rate?runHash=xxx
// Get rating statistics for a pattern
// ========================================================================

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  try {
    const url = new URL(ctx.request.url)
    const runHash = url.searchParams.get('runHash')

    if (!runHash) {
      return jsonResponse(
        { ok: false, error: 'runHash parameter required' },
        400,
      )
    }

    // --- Fetch rating statistics ---
    const statsStmt = ctx.env.DB.prepare(`
      SELECT
        rating_count,
        avg_rating,
        min_rating,
        max_rating,
        high_ratings_count
      FROM pattern_rating_stats
      WHERE run_hash = ?
    `)

    const stats = await statsStmt.bind(runHash).first()

    // --- Fetch user's rating if userId provided ---
    const userId = url.searchParams.get('userId')
    let userRating = null

    if (userId) {
      const userStmt = ctx.env.DB.prepare(`
        SELECT rating, rated_at
        FROM pattern_ratings
        WHERE run_hash = ? AND user_id = ?
      `)
      userRating = await userStmt.bind(runHash, userId).first()
    }

    return jsonResponse({
      ok: true,
      stats: stats || {
        rating_count: 0,
        avg_rating: 0,
        min_rating: 0,
        max_rating: 0,
        high_ratings_count: 0,
      },
      userRating: userRating ? userRating.rating : null,
      userRatedAt: userRating ? userRating.rated_at : null,
    })
  } catch (err) {
    console.error('[/api/rate GET] Error:', err)
    return jsonResponse({ ok: false, error: 'Internal server error' }, 500)
  }
}
