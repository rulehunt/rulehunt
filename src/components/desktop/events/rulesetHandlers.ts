// src/components/desktop/events/rulesetHandlers.ts

import type { CellularAutomata } from '../../../cellular-automata-cpu.ts'
import type { C4Ruleset } from '../../../schema.ts'
import {
  conwayRule,
  expandC4Ruleset,
  makeC4Ruleset,
  mutateC4Ruleset,
} from '../../../utils.ts'
import { outlierRule } from '../../../outlier-rule.ts'
import { renderRule } from '../utils/ruleRenderer.ts'
import { getCurrentThemeColors } from '../../shared/theme.ts'

export interface RulesetHandlerDeps {
  cellularAutomata: CellularAutomata
  orbitLookup: Uint8Array
  ctx: CanvasRenderingContext2D
  ruleCanvas: HTMLCanvasElement
  ruleLabelDisplay: HTMLElement
  ruleIdDisplay: HTMLElement
  stepsPerSecondInput: HTMLInputElement
  orbitSlider: HTMLInputElement
  mutationSlider: HTMLInputElement
  displayMode: { value: 'orbits' | 'full' }
  currentRuleset: { value: C4Ruleset }
  isStarred: { value: boolean }
  updateStarButtonAppearance: () => void
  applyInitialCondition: () => void
}

/**
 * Setup handlers for Conway's Game of Life preset
 */
export function setupConwayHandler(
  btnConway: HTMLButtonElement,
  deps: RulesetHandlerDeps,
) {
  btnConway.addEventListener('click', () => {
    const ruleset = makeC4Ruleset(conwayRule, deps.orbitLookup)
    deps.currentRuleset.value = ruleset
    const colors = getCurrentThemeColors()
    renderRule(
      ruleset,
      deps.orbitLookup,
      deps.ctx,
      deps.ruleCanvas,
      deps.ruleLabelDisplay,
      deps.ruleIdDisplay,
      'Conway',
      deps.displayMode.value,
      colors.fgColor,
      colors.bgColor,
    )
    deps.isStarred.value = false
    deps.updateStarButtonAppearance()
    deps.applyInitialCondition()
    if (deps.cellularAutomata.isCurrentlyPlaying()) {
      deps.cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(deps.stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(deps.currentRuleset.value, deps.orbitLookup)
      deps.cellularAutomata.play(stepsPerSecond, expanded)
    }
  })
}

/**
 * Setup handlers for Outlier preset
 */
export function setupOutlierHandler(
  btnOutlier: HTMLButtonElement,
  deps: RulesetHandlerDeps,
) {
  btnOutlier.addEventListener('click', () => {
    const ruleset = makeC4Ruleset(outlierRule, deps.orbitLookup)
    deps.currentRuleset.value = ruleset
    const colors = getCurrentThemeColors()
    renderRule(
      ruleset,
      deps.orbitLookup,
      deps.ctx,
      deps.ruleCanvas,
      deps.ruleLabelDisplay,
      deps.ruleIdDisplay,
      'Outlier',
      deps.displayMode.value,
      colors.fgColor,
      colors.bgColor,
    )
    deps.isStarred.value = false
    deps.updateStarButtonAppearance()
    deps.applyInitialCondition()
    if (deps.cellularAutomata.isCurrentlyPlaying()) {
      deps.cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(deps.stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(deps.currentRuleset.value, deps.orbitLookup)
      deps.cellularAutomata.play(stepsPerSecond, expanded)
    }
  })
}

/**
 * Setup handler for random ruleset generation
 */
export function setupRandomRulesetHandler(
  btnRandom: HTMLButtonElement,
  generateRandomPatternRule: () => void,
) {
  btnRandom.addEventListener('click', () => {
    generateRandomPatternRule()
  })
}

/**
 * Setup handler for ruleset mutation
 */
export function setupMutateHandler(
  btnMutate: HTMLButtonElement,
  deps: RulesetHandlerDeps,
) {
  btnMutate.addEventListener('click', () => {
    const mutationPercentage = Number.parseInt(deps.mutationSlider.value)
    const magnitude = mutationPercentage / 100
    const mutated = mutateC4Ruleset(deps.currentRuleset.value, magnitude, true)
    deps.currentRuleset.value = mutated
    const colors = getCurrentThemeColors()
    // Remove existing "(mutated)" suffix before adding a new one
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
    deps.applyInitialCondition()
    if (deps.cellularAutomata.isCurrentlyPlaying()) {
      deps.cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(deps.stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(deps.currentRuleset.value, deps.orbitLookup)
      deps.cellularAutomata.play(stepsPerSecond, expanded)
    }
  })
}

/**
 * Setup handler for star button toggle
 */
export function setupStarHandler(
  btnStar: HTMLButtonElement,
  isStarred: { value: boolean },
  updateStarButtonAppearance: () => void,
) {
  btnStar.addEventListener('click', () => {
    isStarred.value = !isStarred.value
    updateStarButtonAppearance()
  })
}

/**
 * Setup handlers for orbit and mutation sliders
 */
export function setupSliderHandlers(
  orbitSlider: HTMLInputElement,
  orbitValue: HTMLElement,
  mutationSlider: HTMLInputElement,
  mutationValue: HTMLElement,
  generateRandomPatternRule: () => void,
) {
  orbitSlider.addEventListener('input', () => {
    orbitValue.textContent = `${orbitSlider.value}%`
    generateRandomPatternRule()
  })

  mutationSlider.addEventListener('input', () => {
    mutationValue.textContent = `${mutationSlider.value}%`
  })
}
