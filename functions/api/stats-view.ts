import { z } from 'zod'
import type { D1Database } from '@cloudflare/workers-types'

interface Env {
  DB: D1Database
}

// ============================================================================
// Request/Response schemas
// ============================================================================

const StatsViewRequest = z.object({
  runId: z.string(),
})

const StatsViewResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

// ============================================================================
// Cloudflare Pages Function handler
// ============================================================================

export const onRequestPost: PagesFunction<Env> = async context => {
  const { request, env } = context

  try {
    // 1. Parse request body
    const body = await request.json()
    const parsed = StatsViewRequest.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { ok: false, error: 'Invalid request body' } satisfies z.infer<
          typeof StatsViewResponse
        >,
        { status: 400 },
      )
    }

    const { runId } = parsed.data

    // 2. Update stats view count
    const result = await env.DB.prepare(
      'UPDATE runs SET stats_view_count = stats_view_count + 1 WHERE run_id = ?',
    )
      .bind(runId)
      .run()

    if (result.meta.changes === 0) {
      return Response.json(
        { ok: false, error: 'Run not found' } satisfies z.infer<
          typeof StatsViewResponse
        >,
        { status: 404 },
      )
    }

    // 3. Success
    return Response.json({ ok: true } satisfies z.infer<typeof StatsViewResponse>)
  } catch (error) {
    console.error('[stats-view] Error:', error)
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies z.infer<typeof StatsViewResponse>,
      { status: 500 },
    )
  }
}