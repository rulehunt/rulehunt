/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { LeaderboardResponse } from '../../src/schema'

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  // --- Helper: standardized JSON response ---
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // --- Parse and validate query parameters ---
    const url = new URL(ctx.request.url)
    const limit = Number(url.searchParams.get('limit')) || 10

    // Validate limit is reasonable
    if (limit < 1 || limit > 100) {
      return json({ ok: false, error: 'Limit must be between 1 and 100' }, 400)
    }

    // --- Query database ---
    const query = `
      SELECT
        run_id,
        user_id,
        user_label,
        ruleset_name,
        ruleset_hex,
        watched_steps,
        watched_wall_ms,
        interest_score,
        entropy4x4,
        submitted_at
      FROM runs
      ORDER BY watched_wall_ms DESC
      LIMIT ?;
    `

    const { results } = await ctx.env.DB.prepare(query).bind(limit).all()

    // --- Validate response with Zod ---
    const validated = LeaderboardResponse.parse({ ok: true, results })
    return json(validated)
  } catch (error) {
    // --- Zod validation errors ---
    if (error instanceof z.ZodError) {
      console.error('Leaderboard validation error:', error.issues)
      // NOTE: Consider removing 'details' in production to avoid leaking schema info
      return json(
        {
          ok: false,
          error: 'Invalid data format',
          details: error.issues,
        },
        500,
      )
    }

    // --- D1 or SQL-related errors ---
    if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
      console.error('Database error fetching leaderboard:', error)
      return json({ ok: false, error: 'Database query failed' }, 500)
    }

    // --- Unknown unexpected errors ---
    console.error('Unexpected error in leaderboard:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
