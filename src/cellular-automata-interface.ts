import type { Ruleset } from './schema.ts'
import type { StatisticsTracker } from './statistics.ts'

export interface ICellularAutomata {
  // Seeding
  clearGrid(): void
  centerSeed(): void
  randomSeed(alivePercentage?: number): void
  patchSeed(alivePercentage?: number): void

  // Simulation
  step(ruleset: Ruleset): void
  render(): void

  // Playback control
  play(stepsPerSecond: number, ruleset: Ruleset): void
  pause(): void
  softReset(): void

  // Zoom and pan
  setZoom(zoom: number, centerX: number, centerY: number): void
  setPan(x: number, y: number): void
  getPan(): { x: number; y: number }
  setZoomAndPan(
    zoom: number,
    zoomCenterX: number,
    zoomCenterY: number,
    panX: number,
    panY: number,
  ): void
  setZoomCentered(zoom: number, screenX: number, screenY: number): void
  resetZoom(): void
  getZoom(): number

  // Colors
  setColors(fgColor: string, bgColor: string): void

  // Resize
  resize(newRows: number, newCols: number): void

  // Getters
  isCurrentlyPlaying(): boolean
  getStatistics(): StatisticsTracker
  getSeed(): number
  getGridSize(): number

  // Cleanup
  destroy(): void
}

export type CellularAutomataOptions = {
  gridRows: number
  gridCols: number
  fgColor: string
  bgColor: string
}
