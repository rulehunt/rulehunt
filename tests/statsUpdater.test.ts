/**
 * Tests for the auto-mutation trigger in statsUpdater.ts
 */

import { describe, expect, it, vi } from 'vitest'
import type { CellularAutomata } from '../src/cellular-automata-cpu'
import { createProgressBar } from '../src/components/desktop/progressBar'
import { createSummaryPanel } from '../src/components/desktop/summary'
import { updateStatisticsDisplay } from '../src/components/desktop/utils/statsUpdater'

const PROGRESS_BAR_STEPS = 500

function createFakeCA(stepCount: number): CellularAutomata {
  return {
    getStatistics: () => ({
      getRecentStats: () => [
        {
          population: 100,
          populationChange: 1,
          activity: 0.1,
          entropy2x2: 0.5,
          entropy4x4: 0.6,
          entropy8x8: 0.7,
          entityCount: 0,
          entityChange: 0,
        },
      ],
      getMetadata: () => ({
        stepCount,
        rulesetName: 'Test',
        rulesetHex: 'abc',
        seedType: 'random',
        seedPercentage: 50,
        requestedStepsPerSecond: 10,
      }),
      calculateInterestScore: () => 0.5,
      getElapsedTime: () => 1000,
      getActualStepsPerSecond: () => 9,
    }),
    getGridSize: () => 400,
  } as unknown as CellularAutomata
}

function setup(stepCount: number) {
  const progressBar = createProgressBar({})
  const summaryPanel = createSummaryPanel()
  const autoMutateCallback = vi.fn()
  const cellularAutomata = createFakeCA(stepCount)
  return { progressBar, summaryPanel, autoMutateCallback, cellularAutomata }
}

describe('updateStatisticsDisplay auto-mutate trigger', () => {
  it('invokes the callback at 100% when the checkbox is checked', () => {
    const { progressBar, summaryPanel, autoMutateCallback, cellularAutomata } =
      setup(PROGRESS_BAR_STEPS)
    const checkbox = progressBar.elements.checkbox
    expect(checkbox).toBeDefined()
    if (checkbox) checkbox.checked = true

    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
      undefined,
      undefined,
      autoMutateCallback,
    )

    expect(progressBar.value()).toBe(100)
    expect(autoMutateCallback).toHaveBeenCalledTimes(1)
  })

  it('does not invoke the callback when the checkbox is unchecked', () => {
    const { progressBar, summaryPanel, autoMutateCallback, cellularAutomata } =
      setup(PROGRESS_BAR_STEPS)
    const checkbox = progressBar.elements.checkbox
    if (checkbox) checkbox.checked = false

    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
      undefined,
      undefined,
      autoMutateCallback,
    )

    expect(autoMutateCallback).not.toHaveBeenCalled()
  })

  it('does not invoke the callback below 100%', () => {
    const { progressBar, summaryPanel, autoMutateCallback, cellularAutomata } =
      setup(PROGRESS_BAR_STEPS - 1)
    const checkbox = progressBar.elements.checkbox
    if (checkbox) checkbox.checked = true

    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
      undefined,
      undefined,
      autoMutateCallback,
    )

    expect(autoMutateCallback).not.toHaveBeenCalled()
  })
})
