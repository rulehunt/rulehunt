import type { D1Database } from '@cloudflare/workers-types'
import { z } from 'zod'

interface Env {
  DB: D1Database
}

// ============================================================================
// Request/Response schemas
// ============================================================================

const ShareRequest = z.object({
  runId: z.string(),
})

const ShareResponse = z.discriminatedUnion('ok', [
  z.object({ ok: z.literal(true) }),
  z.object({ ok: z.literal(false), error: z.string() }),
])

// ============================================================================
// Cloudflare Pages Function handler
// ============================================================================

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context

  try {
    // 1. Parse request body
    const body = await request.json()
    const parsed = ShareRequest.safeParse(body)

    if (!parsed.success) {
      return Response.json(
        { ok: false, error: 'Invalid request body' } satisfies z.infer<
          typeof ShareResponse
        >,
        { status: 400 },
      )
    }

    const { runId } = parsed.data

    // 2. Update share count
    const result = await env.DB.prepare(
      'UPDATE runs SET share_count = share_count + 1 WHERE run_id = ?',
    )
      .bind(runId)
      .run()

    if (result.meta.changes === 0) {
      return Response.json(
        { ok: false, error: 'Run not found' } satisfies z.infer<
          typeof ShareResponse
        >,
        { status: 404 },
      )
    }

    // 3. Success
    return Response.json({ ok: true } satisfies z.infer<typeof ShareResponse>)
  } catch (error) {
    console.error('[share] Error:', error)
    return Response.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } satisfies z.infer<typeof ShareResponse>,
      { status: 500 },
    )
  }
}
