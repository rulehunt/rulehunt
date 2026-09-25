/**
 * Tests for the user-facing notices on the four client-side failure paths
 * (issue #244): saveRun (network failure + server `ok: false`) and
 * submitRating / getRatingStats (network failure).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getRatingStats, submitRating } from '../src/api/rating'
import { saveRun } from '../src/api/save'
import {
  dismissAllErrorNotices,
  getErrorNoticeContainer,
} from '../src/components/shared/errorNotice'
import type { RunSubmission } from '../src/schema'

const payload: Omit<RunSubmission, 'userId' | 'userLabel'> = {
  rulesetName: 'Conway',
  rulesetHex: '0'.repeat(35),
  seed: 42,
  seedType: 'patch',
  seedPercentage: 50,
  stepCount: 100,
  watchedSteps: 100,
  watchedWallMs: 1000,
  gridSize: 128,
  requestedSps: 10,
  actualSps: 9.5,
  population: 0.1,
  activity: 0.2,
  populationChange: 0.01,
  entropy2x2: 1,
  entropy4x4: 2,
  entropy8x8: 3,
  interestScore: 12.5,
  simVersion: 'v0.1.0-test',
}

const ratingParams = {
  runHash: 'abc123',
  userId: 'anonymous',
  rating: 5,
  rulesetHex: '0'.repeat(35),
  seed: 42,
  generation: 100,
}

function noticeText(): string {
  return getErrorNoticeContainer()?.textContent ?? ''
}

function noticeCount(): number {
  return getErrorNoticeContainer()?.children.length ?? 0
}

function firstActionButton(): HTMLButtonElement | null {
  return (
    getErrorNoticeContainer()?.querySelector<HTMLButtonElement>('button') ??
    null
  )
}

/** A fetch Response stand-in for saveRun, which reads `res.text()`. */
function textResponse(body: string, ok = true, status = 200): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as unknown as Response
}

/** A fetch Response stand-in for the rating helpers, which read `res.json()`. */
function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as unknown as Response
}

describe('client API failure notices (issue #244)', () => {
  beforeEach(() => {
    dismissAllErrorNotices()
    document.body.innerHTML = ''
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  afterEach(() => {
    dismissAllErrorNotices()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  describe('saveRun', () => {
    it('shows a notice when the request throws', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockRejectedValue(new Error('network down')),
      )

      const result = await saveRun(payload)

      expect(result.ok).toBe(false)
      expect(noticeCount()).toBe(1)
      expect(noticeText()).toContain("Couldn't save your run")
    })

    it('shows a notice when the server returns ok: false', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            textResponse(JSON.stringify({ ok: false, error: 'rejected' })),
          ),
      )

      const result = await saveRun(payload)

      expect(result.ok).toBe(false)
      expect(noticeText()).toContain("Couldn't save your run")
    })

    it('shows no notice on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockResolvedValue(
            textResponse(JSON.stringify({ ok: true, runHash: 'hash' })),
          ),
      )

      const result = await saveRun(payload)

      expect(result.ok).toBe(true)
      expect(noticeCount()).toBe(0)
    })

    it('does not tell the user the run was stored', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      await saveRun(payload)

      expect(noticeText()).toContain('Nothing was stored')
    })

    it('never puts the raw error text in the notice', async () => {
      vi.stubGlobal(
        'fetch',
        vi
          .fn()
          .mockRejectedValue(new Error('ECONNREFUSED 127.0.0.1:8788 /api/save')),
      )

      await saveRun(payload)

      expect(noticeText()).not.toContain('ECONNREFUSED')
    })

    it('collapses repeated failures into a single notice', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      await saveRun(payload)
      await saveRun(payload)
      await saveRun(payload)

      expect(noticeCount()).toBe(1)
    })

    it('suppresses the notice when notifyOnError is false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const result = await saveRun(payload, { notifyOnError: false })

      expect(result.ok).toBe(false)
      expect(noticeCount()).toBe(0)
    })

    it('offers a retry that re-sends the run and confirms success', async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(
          textResponse(JSON.stringify({ ok: true, runHash: 'hash' })),
        )
      vi.stubGlobal('fetch', fetchMock)

      await saveRun(payload)

      const retryBtn = firstActionButton()
      expect(retryBtn?.textContent).toBe('Retry')

      retryBtn?.click()
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => expect(noticeText()).toContain('Run saved'))
    })

    it('re-shows the failure notice when the retry also fails', async () => {
      const fetchMock = vi.fn().mockRejectedValue(new Error('offline'))
      vi.stubGlobal('fetch', fetchMock)

      await saveRun(payload)
      firstActionButton()?.click()

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => {
        expect(noticeCount()).toBe(1)
        expect(noticeText()).toContain("Couldn't save your run")
      })
    })
  })

  describe('submitRating', () => {
    it('shows a notice when the request throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const result = await submitRating(ratingParams)

      expect(result.ok).toBe(false)
      expect(noticeText()).toContain("Couldn't submit your rating")
      expect(noticeText()).toContain('not recorded')
    })

    it('shows no notice on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ ok: true, rating: 5 })),
      )

      const result = await submitRating(ratingParams)

      expect(result.ok).toBe(true)
      expect(noticeCount()).toBe(0)
    })

    it('suppresses the notice when notifyOnError is false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      await submitRating(ratingParams, { notifyOnError: false })

      expect(noticeCount()).toBe(0)
    })

    it('offers a retry that re-submits the rating', async () => {
      const fetchMock = vi
        .fn()
        .mockRejectedValueOnce(new Error('offline'))
        .mockResolvedValueOnce(jsonResponse({ ok: true, rating: 5 }))
      vi.stubGlobal('fetch', fetchMock)

      await submitRating(ratingParams)
      firstActionButton()?.click()

      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
      await vi.waitFor(() => expect(noticeText()).toContain('Rating submitted'))
    })
  })

  describe('getRatingStats', () => {
    it('shows a notice when the request throws', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      const result = await getRatingStats('abc123')

      expect(result.ok).toBe(false)
      expect(noticeText()).toContain("Couldn't load ratings")
    })

    it('shows no notice on success', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(jsonResponse({ ok: true, stats: {} })),
      )

      const result = await getRatingStats('abc123', 'anonymous')

      expect(result.ok).toBe(true)
      expect(noticeCount()).toBe(0)
    })

    it('suppresses the notice when notifyOnError is false', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

      await getRatingStats('abc123', undefined, { notifyOnError: false })

      expect(noticeCount()).toBe(0)
    })
  })
})
