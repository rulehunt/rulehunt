// src/components/desktop/events/simulationHandlers.ts

import type { CellularAutomata } from '../../../cellular-automata-cpu.ts'
import type { C4Ruleset } from '../../../schema.ts'
import { expandC4Ruleset } from '../../../utils.ts'
import { updateStatisticsDisplay } from '../utils/statsUpdater.ts'
import type { createProgressBar } from '../progressBar.ts'
import type { createStatsBar } from '../statsBar.ts'
import type { SummaryPanelElements } from '../summary.ts'
import type { AudioEngine } from '../../audioEngine.ts'

export interface SimulationHandlerDeps {
  cellularAutomata: CellularAutomata
  currentRuleset: { value: C4Ruleset }
  orbitLookup: Uint8Array
  stepsPerSecondInput: HTMLInputElement
  summaryPanel: { elements: SummaryPanelElements }
  progressBar: ReturnType<typeof createProgressBar>
  statsBar: ReturnType<typeof createStatsBar>
  audioEngine: AudioEngine | null
  statsUpdateInterval: { value: number | null }
  applyInitialCondition: () => void
  initialConditionType: { value: 'center' | 'random' | 'patch' }
  initializeSimulationMetadata: () => void
  updateURL: () => void
}

/**
 * Setup handler for step button (advance one step)
 */
export function setupStepHandler(
  btnStep: HTMLButtonElement,
  btnPlay: HTMLButtonElement,
  deps: SimulationHandlerDeps,
) {
  btnStep.addEventListener('click', () => {
    if (deps.cellularAutomata.isCurrentlyPlaying()) {
      deps.cellularAutomata.pause()
      btnPlay.textContent = 'Play'
      if (deps.statsUpdateInterval.value !== null) {
        clearInterval(deps.statsUpdateInterval.value)
        deps.statsUpdateInterval.value = null
      }
    }
    const expanded = expandC4Ruleset(deps.currentRuleset.value, deps.orbitLookup)
    deps.cellularAutomata.step(expanded)
    updateStatisticsDisplay(
      deps.cellularAutomata,
      deps.summaryPanel.elements,
      deps.progressBar,
      deps.statsBar,
      undefined,
      deps.audioEngine,
    )
  })
}

/**
 * Setup handler for reset button
 */
export function setupResetHandler(
  btnReset: HTMLButtonElement,
  deps: SimulationHandlerDeps,
) {
  const stopResetPulse = () => {
    btnReset.classList.remove('animate-pulse')
    btnReset.style.borderColor = ''
    btnReset.style.borderWidth = ''
  }

  btnReset.addEventListener('click', () => {
    // Stop pulse when user manually resets
    stopResetPulse()

    // Soft reset for patch and random modes (advances seed for new random ICs)
    // Center mode keeps existing behavior (deterministic single pixel)
    if (
      deps.initialConditionType.value === 'patch' ||
      deps.initialConditionType.value === 'random'
    ) {
      const wasPlaying = deps.cellularAutomata.isCurrentlyPlaying()
      deps.cellularAutomata.pause()
      deps.cellularAutomata.clearGrid()
      deps.cellularAutomata.softReset()
      deps.cellularAutomata.render()
      updateStatisticsDisplay(
        deps.cellularAutomata,
        deps.summaryPanel.elements,
        deps.progressBar,
        deps.statsBar,
        undefined,
        deps.audioEngine,
      )
      deps.initializeSimulationMetadata()
      deps.updateURL()

      // Resume playing if it was playing before reset
      if (wasPlaying) {
        const stepsPerSecond = Number.parseInt(deps.stepsPerSecondInput.value)
        const expanded = expandC4Ruleset(
          deps.currentRuleset.value,
          deps.orbitLookup,
        )
        deps.cellularAutomata.play(stepsPerSecond, expanded)
      }
    } else {
      deps.applyInitialCondition()
    }
  })

  return { stopResetPulse }
}

/**
 * Get function to start reset button pulse animation
 */
export function createResetPulseStarter(btnReset: HTMLButtonElement) {
  return () => {
    btnReset.classList.add('animate-pulse')
    btnReset.style.borderColor = '#f97316' // Orange border
    btnReset.style.borderWidth = '2px'
  }
}

/**
 * Setup handler for play/pause button
 */
export function setupPlayPauseHandler(
  btnPlay: HTMLButtonElement,
  deps: SimulationHandlerDeps,
) {
  btnPlay.addEventListener('click', () => {
    if (deps.cellularAutomata.isCurrentlyPlaying()) {
      deps.cellularAutomata.pause()
      btnPlay.textContent = 'Play'
      if (deps.statsUpdateInterval.value !== null) {
        clearInterval(deps.statsUpdateInterval.value)
        deps.statsUpdateInterval.value = null
      }
    } else {
      const stepsPerSecond = Number.parseInt(deps.stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(deps.currentRuleset.value, deps.orbitLookup)
      deps.cellularAutomata.play(stepsPerSecond, expanded)
      btnPlay.textContent = 'Pause'

      const stats = deps.cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      if (metadata) {
        metadata.requestedStepsPerSecond = stepsPerSecond
      }

      deps.statsUpdateInterval.value = setInterval(() => {
        updateStatisticsDisplay(
          deps.cellularAutomata,
          deps.summaryPanel.elements,
          deps.progressBar,
          deps.statsBar,
          undefined,
          deps.audioEngine,
        )
      }, 200) as unknown as number
    }
  })
}

/**
 * Setup handler for steps per second input
 */
export function setupStepsPerSecondHandler(
  stepsPerSecondInput: HTMLInputElement,
  deps: Omit<SimulationHandlerDeps, 'stepsPerSecondInput'>,
) {
  stepsPerSecondInput.addEventListener('change', () => {
    if (deps.cellularAutomata.isCurrentlyPlaying()) {
      deps.cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(deps.currentRuleset.value, deps.orbitLookup)
      deps.cellularAutomata.play(stepsPerSecond, expanded)

      const stats = deps.cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      if (metadata) {
        metadata.requestedStepsPerSecond = stepsPerSecond
      }
    }
  })
}
