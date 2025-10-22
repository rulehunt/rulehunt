// src/components/desktop/events/displayHandlers.ts

import type { C4Ruleset } from '../../../schema.ts'
import { getCurrentThemeColors } from '../../shared/theme.ts'
import { renderRule } from '../utils/ruleRenderer.ts'

export interface DisplayHandlerDeps {
  currentRuleset: { value: C4Ruleset }
  orbitLookup: Uint8Array
  ctx: CanvasRenderingContext2D
  ruleCanvas: HTMLCanvasElement
  ruleLabelDisplay: HTMLElement
  ruleIdDisplay: HTMLElement
  displayMode: { value: 'orbits' | 'full' }
  applyInitialCondition: () => void
  initialConditionType: { value: 'center' | 'random' | 'patch' }
}

/**
 * Setup handlers for display mode radio buttons (orbits vs full)
 */
export function setupDisplayModeHandlers(
  radioDisplayOrbits: HTMLInputElement,
  radioDisplayFull: HTMLInputElement,
  deps: DisplayHandlerDeps,
) {
  radioDisplayOrbits.addEventListener('change', () => {
    if (radioDisplayOrbits.checked) {
      deps.displayMode.value = 'orbits'
      const colors = getCurrentThemeColors()
      renderRule(
        deps.currentRuleset.value,
        deps.orbitLookup,
        deps.ctx,
        deps.ruleCanvas,
        deps.ruleLabelDisplay,
        deps.ruleIdDisplay,
        deps.ruleLabelDisplay.textContent || 'Loading...',
        deps.displayMode.value,
        colors.fgColor,
        colors.bgColor,
      )
    }
  })

  radioDisplayFull.addEventListener('change', () => {
    if (radioDisplayFull.checked) {
      deps.displayMode.value = 'full'
      const colors = getCurrentThemeColors()
      renderRule(
        deps.currentRuleset.value,
        deps.orbitLookup,
        deps.ctx,
        deps.ruleCanvas,
        deps.ruleLabelDisplay,
        deps.ruleIdDisplay,
        deps.ruleLabelDisplay.textContent || 'Loading...',
        deps.displayMode.value,
        colors.fgColor,
        colors.bgColor,
      )
    }
  })
}

/**
 * Setup handlers for seed type radio buttons (center, random, patch)
 */
export function setupSeedTypeHandlers(
  radioCenterSeed: HTMLInputElement,
  radioRandomSeed: HTMLInputElement,
  radioPatchSeed: HTMLInputElement,
  deps: Pick<
    DisplayHandlerDeps,
    'initialConditionType' | 'applyInitialCondition'
  >,
) {
  radioCenterSeed.addEventListener('change', () => {
    if (radioCenterSeed.checked) {
      deps.initialConditionType.value = 'center'
      deps.applyInitialCondition()
    }
  })

  radioRandomSeed.addEventListener('change', () => {
    if (radioRandomSeed.checked) {
      deps.initialConditionType.value = 'random'
      deps.applyInitialCondition()
    }
  })

  radioPatchSeed.addEventListener('change', () => {
    if (radioPatchSeed.checked) {
      deps.initialConditionType.value = 'patch'
      deps.applyInitialCondition()
    }
  })
}

/**
 * Setup handler for alive percentage slider
 */
export function setupAliveSliderHandler(
  aliveSlider: HTMLInputElement,
  applyInitialCondition: () => void,
) {
  aliveSlider.addEventListener('input', () => {
    applyInitialCondition()
  })
}
