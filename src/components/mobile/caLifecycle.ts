// src/components/mobile/caLifecycle.ts

import { createCellularAutomata } from '../../cellular-automata-factory'
import type { ICellularAutomata } from '../../cellular-automata-interface'
import type { C4Ruleset } from '../../schema'
import { expandC4Ruleset } from '../../utils'
import type { RuleData } from './layout'

/**
 * Target frames per second for mobile CA animations.
 * Mobile targets 30 FPS for smoother animations.
 */
const STEPS_PER_SECOND = 30

/**
 * Factory function to create a cellular automaton instance.
 * Wraps the core CA creation with mobile-specific defaults.
 *
 * @param canvas - Canvas element to render CA on
 * @param gridRows - Number of rows in the CA grid
 * @param gridCols - Number of columns in the CA grid
 * @param fgColor - Foreground (alive cell) color
 * @param bgColor - Background (dead cell) color
 * @param onDiedOut - Optional callback when CA dies out (all cells dead)
 * @returns Configured cellular automaton instance
 */
export function createCA(
  canvas: HTMLCanvasElement,
  gridRows: number,
  gridCols: number,
  fgColor: string,
  bgColor: string,
  onDiedOut?: () => void,
): ICellularAutomata {
  return createCellularAutomata(canvas, {
    gridRows,
    gridCols,
    fgColor,
    bgColor,
    onDiedOut,
    // Use default threshold (250K cells = 500x500)
    // Mobile targets ~600K cells, so will use GPU on most devices
  })
}

/**
 * Prepares a cellular automaton with a new rule and initial seed.
 * Handles both random seeding and saved seed patterns for starred rules.
 *
 * @param cellularAutomata - CA instance to prepare
 * @param rule - Rule data including ruleset and optional saved seed
 * @param orbitLookup - Lookup table for C4 rule expansion
 * @param seedPercentage - Percentage of cells to randomly seed (default: 50%)
 */
export function prepareAutomata(
  cellularAutomata: ICellularAutomata,
  rule: RuleData,
  orbitLookup: Uint8Array,
  seedPercentage = 50,
): void {
  cellularAutomata.pause()
  cellularAutomata.clearGrid()

  // If rule has a saved seed (starred pattern), apply it for exact reproduction
  if (rule.seed !== undefined) {
    cellularAutomata.setSeed(rule.seed)
    console.log('[prepareAutomata] Applied saved seed:', rule.seed)
  }

  cellularAutomata.patchSeed(seedPercentage)

  // Expand C4 ruleset if needed (140-entry compact form → full expanded form)
  if (!rule.expanded && (rule.ruleset as number[]).length === 140) {
    rule.expanded = expandC4Ruleset(rule.ruleset as C4Ruleset, orbitLookup)
  }

  cellularAutomata.render()
}

/**
 * Performs a soft reset on the CA: randomizes initial conditions while keeping the rule.
 * Useful for re-running the same rule with a fresh seed.
 *
 * @param cellularAutomata - CA instance to reset
 */
export function softResetAutomata(cellularAutomata: ICellularAutomata): void {
  cellularAutomata.pause()
  cellularAutomata.clearGrid()
  cellularAutomata.softReset()
  cellularAutomata.render()
}

/**
 * Starts or resumes the CA animation with its expanded rule.
 *
 * @param cellularAutomata - CA instance to start
 * @param rule - Rule data with expanded ruleset
 */
export function startAutomata(
  cellularAutomata: ICellularAutomata,
  rule: RuleData,
): void {
  const expanded = rule.expanded ?? rule.ruleset
  cellularAutomata.play(STEPS_PER_SECOND, expanded)
}
