/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { LeaderboardResponse } from '../../src/schema'

// --- Supported sort fields --------------------------------------------------
const SORT_FIELDS = {
  recent: 'submitted_at',
  longest: 'watched_wall_ms',
  interesting: 'interest_score',
} as const

type SortMode = keyof typeof SORT_FIELDS

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  // --- Helper: standardized JSON response -----------------------------------
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // --- Parse and validate query parameters --------------------------------
    const url = new URL(ctx.request.url)
    const sortParam = (url.searchParams.get('sort') ?? 'longest') as SortMode
    const limit = Number(url.searchParams.get('limit')) || 10

    if (limit < 1 || limit > 100) {
      return json({ ok: false, error: 'Limit must be between 1 and 100' }, 400)
    }

    const sortField = SORT_FIELDS[sortParam] ?? SORT_FIELDS.longest

    // --- Build SQL query safely (no interpolation of user data) -------------
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
      ORDER BY ${sortField} DESC
      LIMIT ?;
    `

    // --- Execute query ------------------------------------------------------
    const { results } = await ctx.env.DB.prepare(query).bind(limit).all()

    // --- Validate response with Zod ----------------------------------------
    const validated = LeaderboardResponse.parse({
      ok: true,
      sort: sortParam,
      results,
    })

    return json(validated)
  } catch (error) {
    // --- Handle Zod validation errors --------------------------------------
    if (error instanceof z.ZodError) {
      console.error('Leaderboard validation error:', error.issues)
      return json(
        {
          ok: false,
          error: 'Invalid data format',
          details: error.issues, // optional: remove in production
        },
        500,
      )
    }

    // --- Handle database / D1 / SQL errors ---------------------------------
    if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
      console.error('Database error fetching leaderboard:', error)
      return json({ ok: false, error: 'Database query failed' }, 500)
    }

    // --- Unknown unexpected errors -----------------------------------------
    console.error('Unexpected error in leaderboard:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
