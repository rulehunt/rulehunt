import type { Ruleset } from './schema.ts'
import { StatisticsTracker } from './statistics.ts'

const GRID_ROWS = 300
const GRID_COLS = 300
const GRID_AREA = GRID_ROWS * GRID_COLS

// --- Deterministic RNG ------------------------------------------------------
function makeRng(initialSeed: number) {
  let state = initialSeed | 0
  return function random() {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class CellularAutomata {
  private grid: Uint8Array
  private nextGrid: Uint8Array
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cellSize: number
  private isPlaying = false
  private playInterval: number | null = null
  private statistics: StatisticsTracker

  private seed = Math.floor(Math.random() * 0xffffffff)
  private rng = makeRng(this.seed)
  private lastSeedMethod: 'center' | 'random' | 'patch' = 'random'
  private lastAlivePercentage = 50

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
    this.rng = makeRng(this.seed) // reset PRNG to initial state
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = this.rng() < threshold ? 1 : 0
    }

    this.lastSeedMethod = 'random'
    this.lastAlivePercentage = alivePercentage
    this.statistics.reset()
    this.statistics.recordStep(this.grid)
  }
  patchSeed(alivePercentage = 50) {
    this.rng = makeRng(this.seed) // reset PRNG to same starting point
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = 0
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
          this.grid[y * GRID_COLS + x] = this.rng() < threshold ? 1 : 0
        }
      }
    }

    this.lastSeedMethod = 'patch'
    this.lastAlivePercentage = alivePercentage
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

    // Apply pan boundaries
    this.constrainPan()
    this.render()
  }

  setPan(x: number, y: number) {
    this.panX = x
    this.panY = y
    this.constrainPan()
    this.render()
  }

  getPan(): { x: number; y: number } {
    return { x: this.panX, y: this.panY }
  }

  setZoomAndPan(
    zoom: number,
    zoomCenterX: number,
    zoomCenterY: number,
    panX: number,
    panY: number,
  ) {
    const oldZoom = this.zoom
    this.zoom = Math.max(0.5, Math.min(3, zoom))

    // Adjust pan based on zoom change around the zoom center
    const zoomChange = this.zoom / oldZoom
    const adjustedPanX = zoomCenterX - (zoomCenterX - panX) * zoomChange
    const adjustedPanY = zoomCenterY - (zoomCenterY - panY) * zoomChange

    this.panX = adjustedPanX
    this.panY = adjustedPanY

    // Apply pan boundaries
    this.constrainPan()
    this.render()
  }

  private constrainPan() {
    if (this.zoom <= 1) {
      // When zoomed out, center the grid (no panning)
      this.panX = (this.canvas.width * (1 - this.zoom)) / 2
      this.panY = (this.canvas.height * (1 - this.zoom)) / 2
    } else {
      // When zoomed in, constrain pan to keep grid visible
      // Don't pan beyond the grid edges
      const minPanX = this.canvas.width * (1 - this.zoom)
      const maxPanX = 0
      const minPanY = this.canvas.height * (1 - this.zoom)
      const maxPanY = 0

      this.panX = Math.max(minPanX, Math.min(maxPanX, this.panX))
      this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY))
    }
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

  /**
   * Recreates the exact same initial grid as the first seed,
   * without touching stats or rule state.
   */
  softReset() {
    this.rng = makeRng(this.seed) // reinitialize RNG for deterministic reset

    switch (this.lastSeedMethod) {
      case 'center': {
        for (let i = 0; i < this.grid.length; i++) this.grid[i] = 0
        const cx = Math.floor(GRID_COLS / 2)
        const cy = Math.floor(GRID_ROWS / 2)
        this.grid[cy * GRID_COLS + cx] = 1
        break
      }
      case 'patch':
        this.applyPatchSeed(this.lastAlivePercentage)
        break
      default:
        this.applyRandomSeed(this.lastAlivePercentage)
        break
    }

    this.render()
  }

  private applyRandomSeed(alivePercentage: number) {
    const threshold = alivePercentage / 100
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = this.rng() < threshold ? 1 : 0
    }
  }

  private applyPatchSeed(alivePercentage: number) {
    for (let i = 0; i < this.grid.length; i++) this.grid[i] = 0
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
          this.grid[y * GRID_COLS + x] = this.rng() < threshold ? 1 : 0
        }
      }
    }
  }

  isCurrentlyPlaying(): boolean {
    return this.isPlaying
  }

  getStatistics(): StatisticsTracker {
    return this.statistics
  }

  getSeed(): number {
    return this.seed
  }
}
