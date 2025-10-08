import type { Ruleset } from './schema.ts'
import { StatisticsTracker } from './statistics.ts'

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
  private gridRows: number
  private gridCols: number
  private gridArea: number
  private fgColor: string
  private bgColor: string

  private seed = Math.floor(Math.random() * 0xffffffff)
  private rng = makeRng(this.seed)
  private lastSeedMethod: 'center' | 'random' | 'patch' = 'random'
  private lastAlivePercentage = 50

  private currentRuleset: Ruleset | null = null
  private lastStepsPerSecond = 10

  // Add zoom and pan state
  private zoom = 1
  private panX = 0
  private panY = 0

  constructor(
    canvas: HTMLCanvasElement,
    options: {
      gridRows: number
      gridCols: number
      fgColor: string
      bgColor: string
    },
  ) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D
    this.gridRows = options.gridRows
    this.gridCols = options.gridCols
    this.gridArea = this.gridRows * this.gridCols
    this.cellSize = canvas.width / this.gridCols
    this.fgColor = options.fgColor
    this.bgColor = options.bgColor

    this.grid = new Uint8Array(this.gridArea)
    this.nextGrid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    this.randomSeed()
    this.render()
    this.statistics.recordStep(this.grid)
  }

  setColors(fgColor: string, bgColor: string) {
    this.fgColor = fgColor
    this.bgColor = bgColor
    this.render()
  }

  centerSeed() {
    // Clear the grid first
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = 0
    }

    // Set only the center cell to alive
    const centerX = Math.floor(this.gridCols / 2)
    const centerY = Math.floor(this.gridRows / 2)
    this.grid[centerY * this.gridCols + centerX] = 1

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
    const centerX = Math.floor(this.gridCols / 2)
    const centerY = Math.floor(this.gridRows / 2)
    const patchSize = 10
    const startX = centerX - Math.floor(patchSize / 2)
    const startY = centerY - Math.floor(patchSize / 2)
    for (let dy = 0; dy < patchSize; dy++) {
      for (let dx = 0; dx < patchSize; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
          this.grid[y * this.gridCols + x] = this.rng() < threshold ? 1 : 0
        }
      }
    }

    this.lastSeedMethod = 'patch'
    this.lastAlivePercentage = alivePercentage
    this.statistics.reset()
    this.statistics.recordStep(this.grid)
  }

  step(ruleset: Ruleset) {
    for (let y = 0; y < this.gridRows; y++) {
      for (let x = 0; x < this.gridCols; x++) {
        const pattern = this.get3x3Pattern(x, y)
        const index = this.patternToIndex(pattern)
        this.nextGrid[y * this.gridCols + x] = ruleset[index]
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
        const x = (centerX + dx + this.gridCols) % this.gridCols
        const y = (centerY + dy + this.gridRows) % this.gridRows
        row.push(this.grid[y * this.gridCols + x])
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

    // Clear the canvas
    ctx.fillStyle = this.bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Apply zoom and pan transformations
    ctx.translate(this.panX, this.panY)
    ctx.scale(this.zoom, this.zoom)

    // Draw cells
    ctx.fillStyle = this.fgColor

    for (let y = 0; y < this.gridRows; y++) {
      for (let x = 0; x < this.gridCols; x++) {
        if (this.grid[y * this.gridCols + x]) {
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
    this.currentRuleset = ruleset
    this.lastStepsPerSecond = stepsPerSecond
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
        const cx = Math.floor(this.gridCols / 2)
        const cy = Math.floor(this.gridRows / 2)
        this.grid[cy * this.gridCols + cx] = 1
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
    const centerX = Math.floor(this.gridCols / 2)
    const centerY = Math.floor(this.gridRows / 2)
    const patchSize = 10
    const startX = centerX - Math.floor(patchSize / 2)
    const startY = centerY - Math.floor(patchSize / 2)
    for (let dy = 0; dy < patchSize; dy++) {
      for (let dx = 0; dx < patchSize; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
          this.grid[y * this.gridCols + x] = this.rng() < threshold ? 1 : 0
        }
      }
    }
  }

  /**
   * Resize the grid to new dimensions, reinitializing buffers and reseeding.
   * If a ruleset is currently playing, it will resume after resize.
   */
  resize(newRows: number, newCols: number) {
    const wasPlaying = this.isPlaying
    const ruleset = this.currentRuleset // remember before pausing

    if (wasPlaying) this.pause()

    // Make sure we have up-to-date canvas width/height
    this.canvas.width = this.canvas.clientWidth
    this.canvas.height = this.canvas.clientHeight

    this.gridRows = newRows
    this.gridCols = newCols
    this.gridArea = newRows * newCols
    this.cellSize = this.canvas.width / this.gridCols

    // Allocate new buffers
    this.grid = new Uint8Array(this.gridArea)
    this.nextGrid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    // Re-seed using the last seed method
    switch (this.lastSeedMethod) {
      case 'center':
        this.centerSeed()
        break
      case 'patch':
        this.patchSeed(this.lastAlivePercentage)
        break
      default:
        this.randomSeed(this.lastAlivePercentage)
        break
    }

    // Redraw
    this.render()

    // Resume simulation if it was running
    if (wasPlaying && ruleset) {
      this.play(this.lastStepsPerSecond, ruleset)
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

  getGridSize(): number {
    return this.gridArea
  }
}
