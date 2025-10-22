// src/components/desktop/utils/ruleRenderer.ts

import type { C4Ruleset } from '../../../schema.ts'
import {
  c4RulesetToHex,
  coords10x14,
  coords32x16,
  expandC4Ruleset,
} from '../../../utils.ts'

type DisplayMode = 'orbits' | 'full'

/**
 * Renders a CA rule onto a canvas in either orbit or full pattern mode
 */
export function renderRule(
  ruleset: C4Ruleset,
  orbitLookup: Uint8Array,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ruleLabelDisplay: HTMLElement,
  ruleIdDisplay: HTMLElement,
  ruleLabel: string,
  displayMode: DisplayMode,
  fgColor: string,
  bgColor: string,
  selectedCell?: { type: 'orbit' | 'pattern'; index: number } | null,
) {
  if (displayMode === 'orbits') {
    const cols = 10
    const rows = 14
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = fgColor

    for (let orbit = 0; orbit < 140; orbit++) {
      if (ruleset[orbit]) {
        const { x, y } = coords10x14(orbit)
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
      }
    }

    // Draw blue border around selected cell
    if (selectedCell && selectedCell.type === 'orbit') {
      const { x, y } = coords10x14(selectedCell.index)
      ctx.strokeStyle = '#3b82f6' // blue-500
      ctx.lineWidth = 3
      ctx.strokeRect(x * cellW, y * cellH, cellW, cellH)
    }
  } else {
    const cols = 32
    const rows = 16
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = fgColor

    const expandedRuleset = expandC4Ruleset(ruleset, orbitLookup)

    for (let pattern = 0; pattern < 512; pattern++) {
      if (expandedRuleset[pattern]) {
        const { x, y } = coords32x16(pattern)
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
      }
    }

    // Draw blue border around selected cell
    if (selectedCell && selectedCell.type === 'pattern') {
      const { x, y } = coords32x16(selectedCell.index)
      ctx.strokeStyle = '#3b82f6' // blue-500
      ctx.lineWidth = 3
      ctx.strokeRect(x * cellW, y * cellH, cellW, cellH)
    }
  }

  const hex35 = c4RulesetToHex(ruleset)
  ruleLabelDisplay.textContent = `${ruleLabel}`
  ruleIdDisplay.textContent = `${hex35}`
}
