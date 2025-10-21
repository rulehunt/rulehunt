/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'
import { LeaderboardResponse } from '../../src/schema'
import { handleApiError, jsonResponse } from '../utils/api-helpers'

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
  try {
    // --- Parse and validate query params -----------------------------------
    const url = new URL(ctx.request.url)
    const sortParam = (url.searchParams.get('sort') ?? 'longest') as SortMode
    const limit = Number(url.searchParams.get('limit')) || 10

    if (limit < 1 || limit > 100)
      return jsonResponse(
        { ok: false, error: 'Limit must be between 1 and 100' },
        400,
      )

    const sortField = SORT_FIELDS[sortParam] ?? SORT_FIELDS.longest

    // --- Build SQL query ----------------------------------------------------
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
        entity_count,
        entity_change,
        total_entities_ever_seen,
        unique_patterns,
        entities_alive,
        entities_died,
        submitted_at
      FROM runs
      ORDER BY ${sortField} DESC
      LIMIT ?;
    `

    // --- Execute query ------------------------------------------------------
    const { results } = await ctx.env.DB.prepare(query).bind(limit).all()

    // --- Transform results (if necessary) ----------------------------------
    // Some entries might have nulls for new fields (from older runs)
    for (const r of results) {
      if (r.entity_count === undefined) r.entity_count = null
      if (r.entity_change === undefined) r.entity_change = null
      if (r.total_entities_ever_seen === undefined)
        r.total_entities_ever_seen = null
      if (r.unique_patterns === undefined) r.unique_patterns = null
      if (r.entities_alive === undefined) r.entities_alive = null
      if (r.entities_died === undefined) r.entities_died = null
    }

    // --- Validate with extended schema -------------------------------------
    const ExtendedLeaderboardResponse = LeaderboardResponse.extend({
      results: z.array(
        LeaderboardResponse.shape.results.element.extend({
          entity_count: z.number().nullable().optional(),
          entity_change: z.number().nullable().optional(),
          total_entities_ever_seen: z.number().nullable().optional(),
          unique_patterns: z.number().nullable().optional(),
          entities_alive: z.number().nullable().optional(),
          entities_died: z.number().nullable().optional(),
        }),
      ),
    })

    const validated = ExtendedLeaderboardResponse.parse({
      ok: true,
      sort: sortParam,
      results,
    })

    return jsonResponse(validated)
  } catch (error) {
    return handleApiError(error, 'leaderboard')
  }
}
