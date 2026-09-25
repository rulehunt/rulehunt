// src/components/desktop/events/autoMutateHandler.ts

import { expandC4Ruleset, mutateC4Ruleset } from '../../../utils.ts'
import { getCurrentThemeColors } from '../../shared/theme.ts'
import { renderRule } from '../utils/ruleRenderer.ts'
import type { RulesetHandlerDeps } from './rulesetHandlers.ts'

/** How long to keep showing the completed simulation before mutating. */
export const AUTO_MUTATE_DELAY_MS = 10_000

/** Fallback magnitude when the mutation slider has no usable value. */
export const DEFAULT_MUTATION_MAGNITUDE = 0.5

export interface AutoMutateHandlerDeps extends RulesetHandlerDeps {
  initializeSimulationMetadata: () => void
  updateURL: () => void
}

export interface AutoMutateHandlerOptions {
  /** Overridable for tests; defaults to {@link AUTO_MUTATE_DELAY_MS}. */
  delayMs?: number
}

/**
 * Creates the auto-mutation cycle handler.
 *
 * The returned callback is invoked whenever the progress bar reaches 100% with
 * the "Auto-mutate ruleset on completion" checkbox enabled. It waits
 * `delayMs` (so the finished simulation stays visible), mutates the current
 * ruleset, soft-resets the automaton onto a fresh seed and resumes playback —
 * starting the next cycle.
 *
 * State is kept in the closure so the debounce is per-handler:
 * - `isWaiting` blocks re-entry while a cycle is in flight.
 * - `lastCompletionStep` blocks repeat triggers for a completion already
 *   handled; it is cleared once a new run begins.
 *
 * The cycle is cancelled if the user pauses the simulation during the wait.
 */
export function createAutoMutateHandler(
  deps: AutoMutateHandlerDeps,
  options: AutoMutateHandlerOptions = {},
): () => Promise<void> {
  const delayMs = options.delayMs ?? AUTO_MUTATE_DELAY_MS

  let isWaiting = false
  let lastCompletionStep = -1

  return async () => {
    if (isWaiting) return

    const metadata = deps.cellularAutomata.getStatistics().getMetadata()
    if (!metadata) return

    const currentStep = metadata.stepCount

    // Already handled this completion (step count has not advanced since).
    if (currentStep <= lastCompletionStep) return

    // Only cycle a running simulation.
    if (!deps.cellularAutomata.isCurrentlyPlaying()) return

    isWaiting = true
    lastCompletionStep = currentStep

    try {
      console.log(
        `[auto-mutate] progress complete at step ${currentStep}, waiting ${delayMs}ms`,
      )

      await new Promise((resolve) => setTimeout(resolve, delayMs))

      // The user may have paused (or stepped away from playback) while waiting.
      if (!deps.cellularAutomata.isCurrentlyPlaying()) {
        console.log('[auto-mutate] simulation paused during wait — cancelled')
        return
      }

      const mutationPercentage = Number.parseInt(deps.mutationSlider.value, 10)
      const magnitude = Number.isNaN(mutationPercentage)
        ? DEFAULT_MUTATION_MAGNITUDE
        : mutationPercentage / 100

      const mutated = mutateC4Ruleset(
        deps.currentRuleset.value,
        magnitude,
        true,
      )
      deps.currentRuleset.value = mutated

      const colors = getCurrentThemeColors()
      // Remove an existing "(mutated)" suffix before adding a new one.
      const baseName =
        deps.ruleLabelDisplay.textContent?.replace(/\s*\(mutated\)$/, '') ||
        'Unknown'
      renderRule(
        mutated,
        deps.orbitLookup,
        deps.ctx,
        deps.ruleCanvas,
        deps.ruleLabelDisplay,
        deps.ruleIdDisplay,
        `${baseName} (mutated)`,
        deps.displayMode.value,
        colors.fgColor,
        colors.bgColor,
      )
      deps.isStarred.value = false
      deps.updateStarButtonAppearance()

      // Soft reset onto a fresh seed — same path as the Reset button's
      // "new pattern" branch (simulationHandlers.setupResetHandler).
      deps.cellularAutomata.pause()
      deps.cellularAutomata.clearGrid()
      deps.cellularAutomata.softReset()
      deps.cellularAutomata.render()
      deps.initializeSimulationMetadata()
      deps.updateURL()

      // A fresh run starts at step 0, so re-arm for the next completion.
      lastCompletionStep = -1

      const stepsPerSecond = Number.parseInt(deps.stepsPerSecondInput.value, 10)
      const expanded = expandC4Ruleset(mutated, deps.orbitLookup)
      deps.cellularAutomata.play(stepsPerSecond, expanded)
    } catch (error) {
      console.error('[auto-mutate] cycle failed:', error)
    } finally {
      isWaiting = false
    }
  }
}
