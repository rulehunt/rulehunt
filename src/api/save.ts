// src/api/save.ts
import { z } from 'zod'
import { showErrorNotice } from '../components/shared/errorNotice'
import { getUserIdentity } from '../identity'
import type { RunSubmission } from '../schema'

// ---------------------------------------------------------------------------
// Schema: matches the Cloudflare Worker JSON response
// ---------------------------------------------------------------------------
export const SaveResponse = z.object({
  ok: z.boolean(),
  runHash: z.string().optional(),
  error: z.string().optional(),
  details: z.array(z.any()).optional(),
})

export type SaveResponse = z.infer<typeof SaveResponse>

export interface SaveRunOptions {
  /**
   * Show a user-facing notice when the save fails (default: true).
   *
   * Data mode passes `false`: it retries in a loop and reports failures
   * through its own save-error counter, so a notice per attempt would be noise.
   */
  notifyOnError?: boolean
}

/** Key shared by all save notices, so repeated failures replace each other. */
const SAVE_NOTICE_KEY = 'save-run'

/**
 * Tell the user the run was not stored, and offer a retry.
 *
 * The wording deliberately never implies the data was stored, and never
 * echoes the raw error — the console keeps the diagnostic detail.
 */
function notifySaveFailure(
  data: Omit<RunSubmission, 'userId' | 'userLabel'>,
  options: SaveRunOptions,
): void {
  showErrorNotice({
    key: SAVE_NOTICE_KEY,
    message: "Couldn't save your run",
    detail:
      'Nothing was stored. Check your connection and retry — leaving this page loses the run.',
    action: {
      label: 'Retry',
      onClick: async () => {
        // A failed retry re-renders this same notice (same key).
        const result = await saveRun(data, options)
        if (result.ok) {
          showErrorNotice({
            key: SAVE_NOTICE_KEY,
            tone: 'success',
            message: 'Run saved',
            autoDismissMs: 4000,
          })
        }
      },
    },
  })
}

// ---------------------------------------------------------------------------
// API: saveRun
// ---------------------------------------------------------------------------
/**
 * Frontend helper to submit a simulation run record.
 * Automatically includes the persistent user identity.
 */
export async function saveRun(
  data: Omit<RunSubmission, 'userId' | 'userLabel'>,
  options: SaveRunOptions = {},
): Promise<SaveResponse> {
  const { notifyOnError = true } = options
  const { userId, userLabel } = getUserIdentity()
  const body: RunSubmission = { ...data, userId, userLabel }

  console.log('[saveRun] 📤 Sending payload:', {
    rulesetHex: body.rulesetHex,
    rulesetHexLength: body.rulesetHex?.length,
    rulesetName: body.rulesetName,
    userId: body.userId,
    userLabel: body.userLabel,
  })

  try {
    const res = await fetch('/api/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const responseText = await res.text()
    console.log('[saveRun] 📥 Response:', {
      status: res.status,
      ok: res.ok,
      body: responseText,
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${responseText}`)
    }

    const json = JSON.parse(responseText)
    const result = SaveResponse.parse(json) // ✅ schema-validated

    if (result.ok) {
      console.log('[saveRun] ✅ Success:', result.runHash)
    } else {
      // Server accepted the request but rejected the run: still a failed save.
      console.warn('[saveRun] ⚠️  Server returned ok: false:', result)
      if (notifyOnError) notifySaveFailure(data, options)
    }

    return result
  } catch (err) {
    console.error('[saveRun] ❌ Failed:', err)
    if (notifyOnError) notifySaveFailure(data, options)
    return { ok: false }
  }
}

// ---------------------------------------------------------------------------
// Ruleset Naming Utilities
// ---------------------------------------------------------------------------
/**
 * Generate consistent ruleset names across desktop/mobile/data mode.
 *
 * Examples:
 * - formatRulesetName('conway') → 'Conway'
 * - formatRulesetName('outlier') → 'Outlier'
 * - formatRulesetName('random', 45) → 'Random 45%'
 */
export function formatRulesetName(
  type: 'conway' | 'outlier' | 'random',
  densityPercent?: number,
): string {
  switch (type) {
    case 'conway':
      return 'Conway'
    case 'outlier':
      return 'Outlier'
    case 'random':
      if (densityPercent === undefined) {
        throw new Error('densityPercent required for random rulesets')
      }
      return `Random ${Math.round(densityPercent)}%`
  }
}
