// src/components/desktop/utils/canvasInteraction.ts

import type { C4OrbitsData, C4Ruleset } from '../../../schema.ts'
import { coords32x16, expandC4Ruleset } from '../../../utils.ts'
import type { PatternInspectorData } from '../patternInspector.ts'

type DisplayMode = 'orbits' | 'full'

/**
 * Handles canvas click events for rule visualization, detecting orbit or pattern clicks
 */
export function handleCanvasClick(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  currentRuleset: C4Ruleset,
  orbitsData: C4OrbitsData,
  orbitLookup: Uint8Array,
  displayMode: DisplayMode,
  onPatternClick: (data: PatternInspectorData) => void,
  onSelectionChange: (selection: {
    type: 'orbit' | 'pattern'
    index: number
  }) => void,
) {
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  if (displayMode === 'orbits') {
    const cols = 10
    const rows = 14
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    const gridX = Math.floor(x / cellW)
    const gridY = Math.floor(y / cellH)
    const orbitIndex = gridY * cols + gridX

    if (orbitIndex < 0 || orbitIndex >= 140) return

    const orbit = orbitsData.orbits[orbitIndex]
    const output = currentRuleset[orbitIndex]
    const representative = orbit.representative

    const bits = []
    for (let i = 0; i < 9; i++) {
      bits.push((representative >> i) & 1)
    }

    onPatternClick({
      type: 'orbit',
      index: orbitIndex,
      output,
      bits,
      stabilizer: orbit.stabilizer,
      size: orbit.size,
    })

    onSelectionChange({ type: 'orbit', index: orbitIndex })
  } else {
    const cols = 32
    const rows = 16
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    const gridX = Math.floor(x / cellW)
    const gridY = Math.floor(y / cellH)

    let patternIndex = -1
    for (let p = 0; p < 512; p++) {
      const coord = coords32x16(p)
      if (coord.x === gridX && coord.y === gridY) {
        patternIndex = p
        break
      }
    }

    if (patternIndex === -1) return

    const expandedRuleset = expandC4Ruleset(currentRuleset, orbitLookup)
    const output = expandedRuleset[patternIndex]
    const orbitId = orbitLookup[patternIndex]

    const bits = []
    for (let i = 0; i < 9; i++) {
      bits.push((patternIndex >> i) & 1)
    }

    onPatternClick({
      type: 'pattern',
      index: patternIndex,
      output,
      bits,
      orbitId,
    })

    onSelectionChange({ type: 'pattern', index: patternIndex })
  }
}
