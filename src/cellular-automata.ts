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

  // Zoom and pan state
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

    // Initialize with a random seed
    this.randomSeed()
  }

  setColors(fgColor: string, bgColor: string) {
    this.fgColor = fgColor
    this.bgColor = bgColor
  }
  clearGrid() {
    this.grid.fill(0)
  }

  centerSeed() {
    this.clearGrid()

    const centerX = Math.floor(this.gridCols / 2)
    const centerY = Math.floor(this.gridRows / 2)
    this.grid[centerY * this.gridCols + centerX] = 1

    this.lastSeedMethod = 'center'
  }

  randomSeed(alivePercentage = 50) {
    this.rng = makeRng(this.seed) // reset PRNG to initial state
    const threshold = alivePercentage / 100

    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = this.rng() < threshold ? 1 : 0
    }

    this.lastSeedMethod = 'random'
    this.lastAlivePercentage = alivePercentage
  }

  patchSeed(alivePercentage = 50) {
    this.rng = makeRng(this.seed) // reset PRNG to same starting point
    this.clearGrid()

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
  }

  // --- Simulation step ------------------------------------------------------

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

    // Step still auto-renders and records stats (part of animation loop)
    this.statistics.recordStep(this.grid)
    this.render()
  }

  private get3x3Pattern(centerX: number, centerY: number): number[][] {
    const pattern: number[][] = []

    for (let dy = -1; dy <= 1; dy++) {
      const row: number[] = []
      for (let dx = -1; dx <= 1; dx++) {
        const x = (centerX + dx + this.gridCols) % this.gridCols
        const y = (centerY + dy + this.gridRows) % this.gridRows
        row.push(this.grid[y * this.gridCols + x])
      }
      pattern.push(row)
    }

    return pattern
  }

  private patternToIndex(pattern: number[][]): number {
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

  // --- Zoom and pan (NO side effects) ---------------------------------------

  setZoom(zoom: number, centerX: number, centerY: number) {
    const oldZoom = this.zoom
    this.zoom = Math.max(0.5, Math.min(3, zoom))

    const zoomChange = this.zoom / oldZoom
    this.panX = centerX - (centerX - this.panX) * zoomChange
    this.panY = centerY - (centerY - this.panY) * zoomChange

    this.constrainPan()
  }

  setPan(x: number, y: number) {
    this.panX = x
    this.panY = y
    this.constrainPan()
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

    const zoomChange = this.zoom / oldZoom
    const adjustedPanX = zoomCenterX - (zoomCenterX - panX) * zoomChange
    const adjustedPanY = zoomCenterY - (zoomCenterY - panY) * zoomChange

    this.panX = adjustedPanX
    this.panY = adjustedPanY

    this.constrainPan()
  }

  setZoomCentered(zoom: number, screenX: number, screenY: number) {
    const oldZoom = this.zoom
    this.zoom = Math.max(0.5, Math.min(3, zoom))

    const gridX = (screenX - this.panX) / oldZoom
    const gridY = (screenY - this.panY) / oldZoom

    this.panX = screenX - gridX * this.zoom
    this.panY = screenY - gridY * this.zoom

    this.constrainPan()
  }

  private constrainPan() {
    if (this.zoom <= 1) {
      this.panX = (this.canvas.width * (1 - this.zoom)) / 2
      this.panY = (this.canvas.height * (1 - this.zoom)) / 2
    } else {
      const gridWidth = this.canvas.width / this.zoom
      const gridHeight = this.canvas.height / this.zoom

      const margin = Math.min(this.canvas.width, this.canvas.height) * 0.2

      const minPanX = -gridWidth * this.zoom + margin
      const maxPanX = this.canvas.width - margin
      const minPanY = -gridHeight * this.zoom + margin
      const maxPanY = this.canvas.height - margin

      this.panX = Math.max(minPanX, Math.min(maxPanX, this.panX))
      this.panY = Math.max(minPanY, Math.min(maxPanY, this.panY))
    }
  }

  resetZoom() {
    this.zoom = 1
    this.panX = 0
    this.panY = 0
  }

  getZoom(): number {
    return this.zoom
  }

  // --- Explicit render (called by user) ------------------------------------

  render() {
    const ctx = this.ctx

    ctx.save()

    // Clear with background color
    ctx.fillStyle = this.bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)

    // Apply transformations
    ctx.translate(this.panX, this.panY)
    ctx.scale(this.zoom, this.zoom)

    // Draw alive cells
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

    ctx.restore()
  }

  // --- Playback control -----------------------------------------------------

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

  // --- Soft reset (preserves stats/rule) ------------------------------------

  softReset() {
    this.rng = makeRng(this.seed)

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
  }

  // --- Resize ---------------------------------------------------------------

  resize(newRows: number, newCols: number) {
    const wasPlaying = this.isPlaying
    const ruleset = this.currentRuleset

    if (wasPlaying) this.pause()

    this.canvas.width = this.canvas.clientWidth
    this.canvas.height = this.canvas.clientHeight

    this.gridRows = newRows
    this.gridCols = newCols
    this.gridArea = newRows * newCols
    this.cellSize = this.canvas.width / this.gridCols

    this.grid = new Uint8Array(this.gridArea)
    this.nextGrid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    // Re-seed using last method
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

    // Explicitly render after resize
    this.render()

    // Resume if it was playing
    if (wasPlaying && ruleset) {
      this.play(this.lastStepsPerSecond, ruleset)
    }
  }

  // --- Getters --------------------------------------------------------------

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
