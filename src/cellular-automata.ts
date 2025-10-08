import type { Ruleset } from './schema.ts'
import { StatisticsTracker } from './statistics.ts'

const GRID_ROWS = 300
const GRID_COLS = 300
const GRID_AREA = GRID_ROWS * GRID_COLS

export class CellularAutomata {
  private grid: Uint8Array
  private nextGrid: Uint8Array
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cellSize: number
  private isPlaying = false
  private playInterval: number | null = null
  private statistics: StatisticsTracker

  // Add zoom and pan state
  private zoom = 1
  private panX = 0
  private panY = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    this.cellSize = canvas.width / GRID_COLS

    this.grid = new Uint8Array(GRID_AREA)
    this.nextGrid = new Uint8Array(GRID_AREA)
    this.statistics = new StatisticsTracker(GRID_COLS)

    this.randomSeed()
    this.render()
    this.statistics.recordStep(this.grid)
  }

  centerSeed() {
    // Clear the grid first
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = 0
    }

    // Set only the center cell to alive
    const centerX = Math.floor(GRID_COLS / 2)
    const centerY = Math.floor(GRID_ROWS / 2)
    this.grid[centerY * GRID_COLS + centerX] = 1

    this.statistics.reset()
    this.statistics.recordStep(this.grid)
  }

  randomSeed(alivePercentage = 50) {
    const threshold = alivePercentage / 100
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = Math.random() < threshold ? 1 : 0
    }

    this.statistics.reset()
    this.statistics.recordStep(this.grid)
  }

  patchSeed(alivePercentage = 50) {
    // Clear the grid first
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = 0
    }

    // Fill a 10x10 patch in the center with random noise
    const threshold = alivePercentage / 100
    const centerX = Math.floor(GRID_COLS / 2)
    const centerY = Math.floor(GRID_ROWS / 2)
    const patchSize = 10
    const startX = centerX - Math.floor(patchSize / 2)
    const startY = centerY - Math.floor(patchSize / 2)

    for (let dy = 0; dy < patchSize; dy++) {
      for (let dx = 0; dx < patchSize; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < GRID_COLS && y >= 0 && y < GRID_ROWS) {
          this.grid[y * GRID_COLS + x] = Math.random() < threshold ? 1 : 0
        }
      }
    }

    this.statistics.reset()
    this.statistics.recordStep(this.grid)
  }

  step(ruleset: Ruleset) {
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        const pattern = this.get3x3Pattern(x, y)
        const index = this.patternToIndex(pattern)
        this.nextGrid[y * GRID_COLS + x] = ruleset[index]
      }
    }

    // Swap grids
    const temp = this.grid
    this.grid = this.nextGrid
    this.nextGrid = temp

    this.statistics.recordStep(this.grid)
    this.render()
  }

  private get3x3Pattern(centerX: number, centerY: number): number[][] {
    const pattern: number[][] = []

    for (let dy = -1; dy <= 1; dy++) {
      const row: number[] = []
      for (let dx = -1; dx <= 1; dx++) {
        // Torus topology: wrap around edges
        const x = (centerX + dx + GRID_COLS) % GRID_COLS
        const y = (centerY + dy + GRID_ROWS) % GRID_ROWS
        row.push(this.grid[y * GRID_COLS + x])
      }
      pattern.push(row)
    }

    return pattern
  }

  private patternToIndex(pattern: number[][]): number {
    // Convert 3x3 pattern to 9-bit index
    // Order: top-left to bottom-right, reading left to right, top to bottom
    let index = 0
    let bit = 0

    for (let y = 0; y < 3; y++) {
      for (let x = 0; x < 3; x++) {
        if (pattern[y][x]) {
          index |= 1 << bit
        }
        bit++
      }
    }

    return index
  }

  // Add methods to control zoom and pan
  setZoom(zoom: number, centerX: number, centerY: number) {
    const oldZoom = this.zoom
    this.zoom = Math.max(0.5, Math.min(3, zoom))

    // Adjust pan to zoom towards the center point
    const zoomChange = this.zoom / oldZoom
    this.panX = centerX - (centerX - this.panX) * zoomChange
    this.panY = centerY - (centerY - this.panY) * zoomChange

    this.render()
  }

  resetZoom() {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
    this.render()
  }

  getZoom(): number {
    return this.zoom
  }

  render() {
    const ctx = this.ctx

    // Save the context state
    ctx.save()

    // Get colors from CSS variables
    const styles = getComputedStyle(document.documentElement)
    const bgColor = styles.getPropertyValue('--canvas-bg').trim()
    const fgColor = styles.getPropertyValue('--canvas-fg').trim()

    // Clear the canvas
    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Apply zoom and pan transformations
    ctx.translate(this.panX, this.panY)
    ctx.scale(this.zoom, this.zoom)

    // Draw cells
    ctx.fillStyle = fgColor

    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (this.grid[y * GRID_COLS + x]) {
          ctx.fillRect(
            x * this.cellSize,
            y * this.cellSize,
            this.cellSize,
            this.cellSize,
          )
        }
      }
    }

    // Restore the context state
    ctx.restore()
  }

  play(stepsPerSecond: number, ruleset: Ruleset) {
    if (this.isPlaying) return

    this.isPlaying = true
    const intervalMs = 1000 / stepsPerSecond

    this.playInterval = window.setInterval(() => {
      this.step(ruleset)
    }, intervalMs)
  }

  pause() {
    if (!this.isPlaying) return

    this.isPlaying = false
    if (this.playInterval !== null) {
      clearInterval(this.playInterval)
      this.playInterval = null
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying
  }

  getStatistics(): StatisticsTracker {
    return this.statistics
  }
}
