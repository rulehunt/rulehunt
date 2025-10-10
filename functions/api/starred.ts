/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { StarredResponse } from '../../src/schema'

/**
 * GET /api/starred
 *
 * Fetches a random starred pattern from the database.
 * Returns { ok: true, pattern: {...} } or { ok: true, pattern: null } if no starred patterns exist.
 *
 * Starred patterns are runs where is_starred = 1.
 * The pattern includes ruleset_hex and seed for exact reproduction.
 */
export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // --- Query for random starred pattern -----------------------------------
    // SQLite RANDOM() returns a random integer, ORDER BY it gives random ordering
    const query = `
      SELECT
        ruleset_name,
        ruleset_hex,
        seed,
        seed_type,
        seed_percentage
      FROM runs
      WHERE is_starred = 1
      ORDER BY RANDOM()
      LIMIT 1;
    `

    const { results } = await ctx.env.DB.prepare(query).all()

    // --- Handle no results --------------------------------------------------
    if (!results || results.length === 0) {
      const response = StarredResponse.parse({
        ok: true,
        pattern: null,
      })
      return json(response)
    }

    // --- Validate and return result -----------------------------------------
    const pattern = results[0]

    // Ensure seed_percentage is null if not provided (compatibility)
    if (pattern.seed_percentage === undefined) {
      pattern.seed_percentage = null
    }

    const response = StarredResponse.parse({
      ok: true,
      pattern,
    })

    return json(response)
  } catch (error) {
    // --- Zod validation errors ----------------------------------------------
    if (error instanceof z.ZodError) {
      console.error('Starred pattern validation error:', error.issues)
      return json(
        { ok: false, error: 'Invalid data format', details: error.issues },
        500,
      )
    }

    // --- Database errors ----------------------------------------------------
    if (error instanceof Error && /D1|SQL|prepare|bind/i.test(error.message)) {
      console.error('Database error fetching starred pattern:', error)
      return json({ ok: false, error: 'Database query failed' }, 500)
    }

    // --- Unexpected errors --------------------------------------------------
    console.error('Unexpected error in starred endpoint:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
