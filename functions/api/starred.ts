/// <reference types="@cloudflare/workers-types" />
import type { D1Database, EventContext } from '@cloudflare/workers-types'
import { z } from 'zod'

// Response schema for starred pattern
const StarredPatternResponse = z.object({
  ok: z.literal(true),
  pattern: z
    .object({
      ruleset_name: z.string(),
      ruleset_hex: z.string().regex(/^[0-9a-f]{35}$/i),
      seed: z.number().int(),
      seed_type: z.enum(['center', 'random', 'patch']),
      seed_percentage: z.number().nullable(),
    })
    .nullable(),
})

export const onRequestGet = async (
  ctx: EventContext<{ DB: D1Database }, string, Record<string, unknown>>,
): Promise<Response> => {
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data, null, 2), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })

  try {
    // Query for a random starred pattern
    const stmt = ctx.env.DB.prepare(`
      SELECT
        ruleset_name,
        ruleset_hex,
        seed,
        seed_type,
        seed_percentage
      FROM runs
      WHERE is_starred = 1
      ORDER BY RANDOM()
      LIMIT 1
    `)

    const result = await stmt.first()

    if (!result) {
      // No starred patterns found - return null pattern
      return json({ ok: true, pattern: null })
    }

    // Return the starred pattern
    const response = {
      ok: true,
      pattern: {
        ruleset_name: result.ruleset_name as string,
        ruleset_hex: result.ruleset_hex as string,
        seed: result.seed as number,
        seed_type: result.seed_type as 'center' | 'random' | 'patch',
        seed_percentage: result.seed_percentage as number | null,
      },
    }

    // Validate response schema
    StarredPatternResponse.parse(response)

    return json(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.warn('Starred pattern response validation error:', error.issues)
      return json(
        {
          ok: false,
          error: 'Invalid response format',
          details: error.issues,
        },
        500,
      )
    }

    console.error('Error fetching starred pattern:', error)
    return json({ ok: false, error: 'Internal server error' }, 500)
  }
}
