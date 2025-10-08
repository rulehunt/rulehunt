/// <reference types="@cloudflare/workers-types" />

import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { LeaderboardResponse } from '../../src/schema'

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
) => {
  const url = new URL(ctx.request.url)
  const limit = Number(url.searchParams.get('limit')) || 10

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

  return Response.json(LeaderboardResponse.parse({ ok: true, results }))
}
