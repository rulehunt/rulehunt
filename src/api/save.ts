// src/api/save.ts
import { z } from 'zod'
import { getUserIdentity } from '../identity'
import type { RunSubmission } from '../schema'

// ---------------------------------------------------------------------------
// Schema: matches the Cloudflare Worker JSON response
// ---------------------------------------------------------------------------
export const SaveResponse = z.object({
  ok: z.boolean(),
  runHash: z.string().optional(),
})

export type SaveResponse = z.infer<typeof SaveResponse>

// ---------------------------------------------------------------------------
// API: saveRun
// ---------------------------------------------------------------------------
/**
 * Frontend helper to submit a simulation run record.
 * Automatically includes the persistent user identity.
 */
export async function saveRun(
  data: Omit<RunSubmission, 'userId' | 'userLabel'>,
): Promise<SaveResponse> {
  const { userId, userLabel } = getUserIdentity()
  const body: RunSubmission = { ...data, userId, userLabel }

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    }

    const json = await res.json()
    const result = SaveResponse.parse(json) // ✅ schema-validated
    console.log('[saveRun] ✅', result)
    return result
  } catch (err) {
    console.error('[saveRun] ❌ failed', err)
    return { ok: false }
  }
}
