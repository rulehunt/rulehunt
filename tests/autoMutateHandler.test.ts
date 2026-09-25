/**
 * Tests for the desktop auto-mutation cycle (autoMutateHandler.ts)
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CellularAutomata } from '../src/cellular-automata-cpu'
import {
  AUTO_MUTATE_DELAY_MS,
  type AutoMutateHandlerDeps,
  createAutoMutateHandler,
} from '../src/components/desktop/events/autoMutateHandler'
import type { C4Ruleset } from '../src/schema'
import { mutateC4Ruleset } from '../src/utils'

vi.mock('../src/components/desktop/utils/ruleRenderer.ts', () => ({
  renderRule: vi.fn(),
}))

vi.mock('../src/utils.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/utils')>()
  return {
    ...actual,
    mutateC4Ruleset: vi.fn(actual.mutateC4Ruleset),
  }
})

function createRuleset(): C4Ruleset {
  return new Array(140).fill(0) as unknown as C4Ruleset
}

function createInput(value: string): HTMLInputElement {
  const input = document.createElement('input')
  input.value = value
  return input
}

interface FakeCA {
  metadata: { stepCount: number } | null
  playing: boolean
  pause: ReturnType<typeof vi.fn>
  clearGrid: ReturnType<typeof vi.fn>
  softReset: ReturnType<typeof vi.fn>
  render: ReturnType<typeof vi.fn>
  play: ReturnType<typeof vi.fn>
}

function createFakeCA(): FakeCA {
  const ca: FakeCA = {
    metadata: { stepCount: 600 },
    playing: true,
    pause: vi.fn(() => {
      ca.playing = false
    }),
    clearGrid: vi.fn(),
    softReset: vi.fn(),
    render: vi.fn(),
    play: vi.fn(() => {
      ca.playing = true
    }),
  }
  return ca
}

function createDeps(ca: FakeCA): AutoMutateHandlerDeps {
  const cellularAutomata = {
    getStatistics: () => ({ getMetadata: () => ca.metadata }),
    isCurrentlyPlaying: () => ca.playing,
    pause: ca.pause,
    clearGrid: ca.clearGrid,
    softReset: ca.softReset,
    render: ca.render,
    play: ca.play,
  } as unknown as CellularAutomata

  return {
    cellularAutomata,
    orbitLookup: new Uint8Array(512),
    ctx: {} as CanvasRenderingContext2D,
    ruleCanvas: document.createElement('canvas'),
    ruleLabelDisplay: document.createElement('span'),
    ruleIdDisplay: document.createElement('span'),
    stepsPerSecondInput: createInput('25'),
    orbitSlider: createInput('50'),
    mutationSlider: createInput('20'),
    displayMode: { value: 'orbits' },
    currentRuleset: { value: createRuleset() },
    isStarred: { value: true },
    updateStarButtonAppearance: vi.fn(),
    applyInitialCondition: vi.fn(),
    initializeSimulationMetadata: vi.fn(),
    updateURL: vi.fn(),
  }
}

describe('createAutoMutateHandler', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(mutateC4Ruleset).mockClear()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('exposes a 10 second default delay', () => {
    expect(AUTO_MUTATE_DELAY_MS).toBe(10_000)
  })

  it('waits the full delay before mutating', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps)

    const pending = handler()
    await vi.advanceTimersByTimeAsync(AUTO_MUTATE_DELAY_MS - 1)
    expect(mutateC4Ruleset).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await pending
    expect(mutateC4Ruleset).toHaveBeenCalledTimes(1)
  })

  it('mutates, soft resets and resumes playback', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    const original = deps.currentRuleset.value
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    const pending = handler()
    await vi.advanceTimersByTimeAsync(10)
    await pending

    expect(deps.currentRuleset.value).not.toBe(original)
    expect(deps.isStarred.value).toBe(false)
    expect(deps.updateStarButtonAppearance).toHaveBeenCalled()

    expect(ca.pause).toHaveBeenCalledTimes(1)
    expect(ca.clearGrid).toHaveBeenCalledTimes(1)
    expect(ca.softReset).toHaveBeenCalledTimes(1)
    expect(ca.render).toHaveBeenCalledTimes(1)
    expect(deps.initializeSimulationMetadata).toHaveBeenCalledTimes(1)
    expect(deps.updateURL).toHaveBeenCalledTimes(1)

    // Resumes with the steps-per-second from the UI and the expanded ruleset
    expect(ca.play).toHaveBeenCalledTimes(1)
    expect(ca.play.mock.calls[0][0]).toBe(25)
    expect(ca.play.mock.calls[0][1]).toHaveLength(512)
    expect(ca.playing).toBe(true)
  })

  it('uses the mutation slider value as the magnitude', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    deps.mutationSlider.value = '35'
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    const pending = handler()
    await vi.advanceTimersByTimeAsync(10)
    await pending

    expect(mutateC4Ruleset).toHaveBeenCalledWith(
      expect.anything(),
      0.35,
      true,
    )
  })

  it('falls back to the default magnitude when the slider is unusable', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    deps.mutationSlider.value = ''
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    const pending = handler()
    await vi.advanceTimersByTimeAsync(10)
    await pending

    expect(mutateC4Ruleset).toHaveBeenCalledWith(expect.anything(), 0.5, true)
  })

  it('does nothing when the simulation is paused', async () => {
    const ca = createFakeCA()
    ca.playing = false
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    await handler()
    await vi.advanceTimersByTimeAsync(10)

    expect(mutateC4Ruleset).not.toHaveBeenCalled()
  })

  it('does nothing without simulation metadata', async () => {
    const ca = createFakeCA()
    ca.metadata = null
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    await handler()
    await vi.advanceTimersByTimeAsync(10)

    expect(mutateC4Ruleset).not.toHaveBeenCalled()
  })

  it('cancels the cycle if the user pauses during the wait', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    const pending = handler()
    ca.playing = false
    await vi.advanceTimersByTimeAsync(10)
    await pending

    expect(mutateC4Ruleset).not.toHaveBeenCalled()
    expect(ca.softReset).not.toHaveBeenCalled()
    expect(ca.play).not.toHaveBeenCalled()
  })

  it('ignores repeat triggers while a cycle is in flight', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    const first = handler()
    const second = handler()
    const third = handler()
    await vi.advanceTimersByTimeAsync(10)
    await Promise.all([first, second, third])

    expect(mutateC4Ruleset).toHaveBeenCalledTimes(1)
    expect(ca.softReset).toHaveBeenCalledTimes(1)
  })

  it('does not re-trigger for a completion it already handled', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    // First attempt is cancelled by a pause, leaving the step count unchanged
    const pending = handler()
    ca.playing = false
    await vi.advanceTimersByTimeAsync(10)
    await pending
    ca.playing = true

    await handler()
    await vi.advanceTimersByTimeAsync(10)

    expect(mutateC4Ruleset).not.toHaveBeenCalled()
  })

  it('re-arms for the next completion after a successful cycle', async () => {
    const ca = createFakeCA()
    const deps = createDeps(ca)
    const handler = createAutoMutateHandler(deps, { delayMs: 10 })

    const first = handler()
    await vi.advanceTimersByTimeAsync(10)
    await first

    // The new run reaches 100% with a step count starting from zero again
    ca.metadata = { stepCount: 500 }
    const second = handler()
    await vi.advanceTimersByTimeAsync(10)
    await second

    expect(mutateC4Ruleset).toHaveBeenCalledTimes(2)
    expect(ca.softReset).toHaveBeenCalledTimes(2)
  })
})
