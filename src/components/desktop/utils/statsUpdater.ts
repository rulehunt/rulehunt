// src/components/desktop/utils/statsUpdater.ts

import type { CellularAutomata } from '../../../cellular-automata-cpu.ts'
import type { AudioEngine } from '../../../components/audioEngine.ts'
import { generateSimulationMetricsHTML } from '../../shared/simulationInfo.ts'
import { generateStatsHTML, getInterestColorClass } from '../../shared/stats.ts'
import type { createProgressBar } from '../progressBar.ts'
import type { createStatsBar } from '../statsBar.ts'
import type { SummaryPanelElements } from '../summary.ts'

const PROGRESS_BAR_STEPS = 500

/**
 * Updates the statistics display panels with current CA statistics
 */
export function updateStatisticsDisplay(
  cellularAutomata: CellularAutomata,
  elements: SummaryPanelElements,
  progressBar: ReturnType<typeof createProgressBar>,
  statsBarComponent?: ReturnType<typeof createStatsBar>,
  autosaveCallback?: () => void,
  audioEngine?: AudioEngine | null,
) {
  const stats = cellularAutomata.getStatistics()
  const recentStats = stats.getRecentStats(1)
  const metadata = stats.getMetadata()

  if (recentStats.length === 0) return

  const current = recentStats[0]
  const interestScore = stats.calculateInterestScore()

  if (metadata) {
    const stepCount = metadata.stepCount
    const progressPercent = Math.min(
      (stepCount / PROGRESS_BAR_STEPS) * 100,
      100,
    )
    progressBar.set(Math.round(progressPercent))

    // Check for autosave after updating progress
    if (autosaveCallback) {
      autosaveCallback()
    }
  }

  // Update simulation metrics
  if (metadata) {
    const metricsData = {
      rulesetName: metadata.rulesetName,
      rulesetHex: metadata.rulesetHex,
      seedType: metadata.seedType,
      seedPercentage: metadata.seedPercentage,
      stepCount: metadata.stepCount,
      elapsedTime: stats.getElapsedTime(),
      actualSps: stats.getActualStepsPerSecond(),
      requestedSps: metadata.requestedStepsPerSecond,
      gridSize: cellularAutomata.getGridSize(),
    }
    elements.metricsContainer.innerHTML =
      generateSimulationMetricsHTML(metricsData)
  }

  // Generate stats HTML and update the container
  const statsData = { ...current, interestScore }
  elements.statsContainer.innerHTML = generateStatsHTML(statsData)

  // Apply interest score color to the interest field
  const interestField = elements.statsContainer.querySelector(
    '[data-field="interest"]',
  )
  if (interestField) {
    interestField.className = `text-gray-900 dark:text-white font-semibold text-lg ${getInterestColorClass(interestScore)}`
  }

  // Update stats bar (for Explore tab)
  if (statsBarComponent) {
    statsBarComponent.update({
      population: current.population,
      activity: current.activity,
      interestScore,
      stepCount: metadata?.stepCount ?? 0,
    })
  }

  // Update audio engine with current statistics
  if (audioEngine) {
    audioEngine.updateFromStats(current)
  }
}
