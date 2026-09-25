/**
 * Regression tests for data mode's save retry loop (issue #255).
 *
 * `saveRunWithRetry` used to discard `saveRun`'s result and `return true`
 * unconditionally, so every failed save was logged and reported as a success,
 * the backoff never ran a second attempt, and `incrementSaveErrorCount()` was
 * unreachable. These tests cover both of `saveRun`'s non-throwing failure
 * paths: a caught network error, and a server replying HTTP 200 with
 * `{"ok": false}`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { saveRun } from '../src/api/save'
import { SAVE_RETRY_ATTEMPTS, saveRunWithRetry } from '../src/dataRunner'
import { incrementSaveErrorCount } from '../src/dataStorage'
import type { RunSubmission } from '../src/schema'

vi.mock('../src/api/save.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/save')>()
  return { ...actual, saveRun: vi.fn(actual.saveRun) }
})

vi.mock('../src/dataStorage.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/dataStorage')>()
  return { ...actual, incrementSaveErrorCount: vi.fn() }
})

const saveRunMock = vi.mocked(saveRun)
const incrementSaveErrorCountMock = vi.mocked(incrementSaveErrorCount)

const payload: Omit<RunSubmission, 'userId' | 'userLabel'> = {
  rulesetName: 'Conway',
  rulesetHex: '0'.repeat(35),
  seed: 42,
  seedType: 'patch',
  stepCount: 500,
  watchedSteps: 500,
  watchedWallMs: 1000,
  gridSize: 400,
  actualSps: 500,
  population: 0.1,
  activity: 0.2,
  populationChange: 0.01,
  entropy2x2: 1,
  entropy4x4: 2,
  entropy8x8: 3,
  interestScore: 12.5,
  simVersion: 'v0.1.0-datamode',
}

/** Text of every console.log line recorded by the spy. */
function loggedLines(spy: ReturnType<typeof vi.spyOn>): string {
  return spy.mock.calls.map((args) => args.join(' ')).join('\n')
}

describe('saveRunWithRetry', () => {
  let logSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('returns false and retries SAVE_RETRY_ATTEMPTS times when saveRun returns { ok: false }', async () => {
    saveRunMock.mockResolvedValue({ ok: false })
    vi.useFakeTimers()

    const pending = saveRunWithRetry(payload)

    // Attempt 1 fires immediately, then backs off 1s.
    await vi.advanceTimersByTimeAsync(0)
    expect(saveRunMock).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(999)
    expect(saveRunMock).toHaveBeenCalledTimes(1)

    // Attempt 2 at +1s, then backs off 2s.
    await vi.advanceTimersByTimeAsync(1)
    expect(saveRunMock).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(1999)
    expect(saveRunMock).toHaveBeenCalledTimes(2)

    // Attempt 3 at +3s.
    await vi.advanceTimersByTimeAsync(1)
    expect(saveRunMock).toHaveBeenCalledTimes(SAVE_RETRY_ATTEMPTS)

    await expect(pending).resolves.toBe(false)
    expect(incrementSaveErrorCountMock).toHaveBeenCalledTimes(1)
    expect(loggedLines(logSpy)).not.toContain('Run saved successfully')
  })

  it('returns false when the server replies HTTP 200 with { ok: false }', async () => {
    // Exercises the real saveRun, which returns { ok: false } on this path
    // without throwing or catching anything.
    const actual =
      await vi.importActual<typeof import('../src/api/save')>(
        '../src/api/save',
      )
    saveRunMock.mockImplementation(actual.saveRun)

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: false, error: 'quota exceeded' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)
    vi.useFakeTimers()

    const pending = saveRunWithRetry(payload)
    await vi.advanceTimersByTimeAsync(3000)

    await expect(pending).resolves.toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(SAVE_RETRY_ATTEMPTS)
    expect(incrementSaveErrorCountMock).toHaveBeenCalledTimes(1)
    expect(loggedLines(logSpy)).not.toContain('Run saved successfully')

    vi.unstubAllGlobals()
  })

  it('returns true and stops retrying once a save succeeds', async () => {
    saveRunMock
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, runHash: 'abc123' })
    vi.useFakeTimers()

    const pending = saveRunWithRetry(payload)
    await vi.advanceTimersByTimeAsync(1000)

    await expect(pending).resolves.toBe(true)
    expect(saveRunMock).toHaveBeenCalledTimes(2)
    expect(incrementSaveErrorCountMock).not.toHaveBeenCalled()
    expect(loggedLines(logSpy)).toContain('Run saved successfully (attempt 2)')
  })

  it('suppresses the per-attempt user notice', async () => {
    saveRunMock.mockResolvedValue({ ok: true, runHash: 'abc123' })

    await expect(saveRunWithRetry(payload)).resolves.toBe(true)
    expect(saveRunMock).toHaveBeenCalledWith(payload, { notifyOnError: false })
  })
})
