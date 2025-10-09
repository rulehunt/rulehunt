import type { Ruleset } from './schema.ts'
import type { StatisticsTracker } from './statistics.ts'

export interface ICellularAutomata {
  // getters
  getCurrentRuleset(): Ruleset | null
  getLastStepsPerSecond(): number
  isRunning(): boolean

  // Seeding
  clearGrid(): void
  centerSeed(): void
  randomSeed(alivePercentage?: number): void
  patchSeed(alivePercentage?: number): void

  // Simulation
  step(ruleset: Ruleset): void

  setZoom(level: number): void
  getZoom(): number

  render(): void

  // Playback control
  play(stepsPerSecond: number, ruleset?: Ruleset): void
  pause(): void
  softReset(): void

  // Colors
  setColors(fgColor: string, bgColor: string): void

  // Resize
  resize(newRows: number, newCols: number): void

  // Getters
  isCurrentlyPlaying(): boolean
  getStatistics(): StatisticsTracker
  getSeed(): number
  getGridSize(): number

  // Grid access (for testing and debugging)
  getGrid(): Uint8Array
  setGrid(newGrid: Uint8Array): void

  // Cleanup
  destroy(): void
}

export type CellularAutomataOptions = {
  gridRows: number
  gridCols: number
  fgColor: string
  bgColor: string
}
