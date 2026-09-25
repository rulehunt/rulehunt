/**
 * Tests for ensureRunHash, the get-or-create-run-hash helper shared by the
 * mobile share and stats buttons.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ICellularAutomata } from '../src/cellular-automata-interface'
import {
  type RunData,
  ensureRunHash,
} from '../src/components/mobile/ui/runHash'

const fakeCA = {} as ICellularAutomata

function createRunData(isStarred = false): RunData {
  return {
    ca: fakeCA,
    rule: {
      name: 'Conway',
      hex: 'deadbeef',
    } as RunData['rule'],
    isStarred,
  }
}

describe('ensureRunHash', () => {
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })

  it('returns the existing hash without saving', async () => {
    const saveRunStatistics = vi.fn()
    const setLastRunHash = vi.fn()
    const getRunData = vi.fn(() => createRunData())

    const hash = await ensureRunHash(
      getRunData,
      () => 'existing-hash',
      setLastRunHash,
      saveRunStatistics,
    )

    expect(hash).toBe('existing-hash')
    expect(saveRunStatistics).not.toHaveBeenCalled()
    expect(setLastRunHash).not.toHaveBeenCalled()
    expect(getRunData).not.toHaveBeenCalled()
  })

  it('saves the run and stores the new hash when none exists', async () => {
    const saveRunStatistics = vi.fn(async () => 'new-hash')
    const setLastRunHash = vi.fn()

    const hash = await ensureRunHash(
      () => createRunData(true),
      () => undefined,
      setLastRunHash,
      saveRunStatistics,
    )

    expect(hash).toBe('new-hash')
    expect(saveRunStatistics).toHaveBeenCalledWith(
      fakeCA,
      'Conway',
      'deadbeef',
      true,
    )
    expect(setLastRunHash).toHaveBeenCalledWith('new-hash')
  })

  it('returns undefined and stores nothing when the save fails', async () => {
    const setLastRunHash = vi.fn()

    const hash = await ensureRunHash(
      () => createRunData(),
      () => undefined,
      setLastRunHash,
      async () => undefined,
    )

    expect(hash).toBeUndefined()
    expect(setLastRunHash).not.toHaveBeenCalled()
  })

  it('does not attempt a save when the statistics callbacks are absent', async () => {
    const getRunData = vi.fn(() => createRunData())

    await expect(ensureRunHash()).resolves.toBeUndefined()
    await expect(
      ensureRunHash(getRunData, () => undefined),
    ).resolves.toBeUndefined()
    expect(getRunData).not.toHaveBeenCalled()
  })
})
