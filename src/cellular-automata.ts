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

// --- Helper: color parsing --------------------------------------------------
function hexToRGB(hex: string): [number, number, number] {
  const h = hex.startsWith('#') ? hex.slice(1) : hex
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
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
  private fgRGB: [number, number, number]
  private bgRGB: [number, number, number]
  private neighborOffsets: number[]
  private imageData: ImageData
  private pixelData: Uint8ClampedArray

  private seed = Math.floor(Math.random() * 0xffffffff)
  private rng = makeRng(this.seed)
  private lastSeedMethod: 'center' | 'random' | 'patch' = 'random'
  private lastAlivePercentage = 50

  private currentRuleset: Ruleset | null = null
  private lastStepsPerSecond = 10

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
    this.fgRGB = hexToRGB(this.fgColor)
    this.bgRGB = hexToRGB(this.bgColor)

    this.grid = new Uint8Array(this.gridArea)
    this.nextGrid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    // Precompute neighbor offsets for the 3x3 kernel
    const c = this.gridCols
    this.neighborOffsets = [
      -c - 1, -c, -c + 1,
      -1, 0, 1,
      c - 1, c, c + 1,
    ]

    this.imageData = this.ctx.createImageData(this.gridCols, this.gridRows)
    this.pixelData = this.imageData.data

    this.randomSeed()
  }

  setColors(fgColor: string, bgColor: string) {
    this.fgColor = fgColor
    this.bgColor = bgColor
    this.fgRGB = hexToRGB(fgColor)
    this.bgRGB = hexToRGB(bgColor)
  }

  clearGrid() {
    this.grid.fill(0)
  }

  centerSeed() {
    this.clearGrid()
    const cx = Math.floor(this.gridCols / 2)
    const cy = Math.floor(this.gridRows / 2)
    this.grid[cy * this.gridCols + cx] = 1
    this.lastSeedMethod = 'center'
  }

  randomSeed(alivePercentage = 50) {
    this.rng = makeRng(this.seed)
    const threshold = alivePercentage / 100
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = this.rng() < threshold ? 1 : 0
    }
    this.lastSeedMethod = 'random'
    this.lastAlivePercentage = alivePercentage
  }

  patchSeed(alivePercentage = 50) {
    this.rng = makeRng(this.seed)
    this.clearGrid()
    const threshold = alivePercentage / 100
    const cx = Math.floor(this.gridCols / 2)
    const cy = Math.floor(this.gridRows / 2)
    const patch = 10
    const startX = cx - Math.floor(patch / 2)
    const startY = cy - Math.floor(patch / 2)
    for (let dy = 0; dy < patch; dy++) {
      for (let dx = 0; dx < patch; dx++) {
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

  // --- Simulation step (optimized) ------------------------------------------
  step(ruleset: Ruleset) {
    const cols = this.gridCols
    const rows = this.gridRows
    const grid = this.grid
    const next = this.nextGrid
    const offsets = this.neighborOffsets

    for (let y = 0; y < rows; y++) {
      const yOffset = y * cols
      for (let x = 0; x < cols; x++) {
        let index = 0
        let bit = 0
        for (let k = 0; k < 9; k++) {
          const off = offsets[k]
          const nx = (x + (off % cols) + cols) % cols
          const ny = (y + Math.floor(off / cols) + rows) % rows
          if (grid[ny * cols + nx]) index |= 1 << bit
          bit++
        }
        next[yOffset + x] = ruleset[index]
      }
    }

    const tmp = this.grid
    this.grid = this.nextGrid
    this.nextGrid = tmp

    this.statistics.recordStep(this.grid)
    this.render() // preserve auto-render side effect
  }

  // --- Explicit render (optimized) ------------------------------------------
  render() {
    const ctx = this.ctx
    const grid = this.grid
    const data = this.pixelData
    const [fr, fg, fb] = this.fgRGB
    const [br, bg, bb] = this.bgRGB

    for (let i = 0, j = 0; i < grid.length; i++, j += 4) {
      if (grid[i]) {
        data[j] = fr
        data[j + 1] = fg
        data[j + 2] = fb
      } else {
        data[j] = br
        data[j + 1] = bg
        data[j + 2] = bb
      }
      data[j + 3] = 255
    }

    ctx.save()
    ctx.fillStyle = this.bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.translate(this.panX, this.panY)
    ctx.scale(this.zoom, this.zoom)
    ctx.putImageData(this.imageData, 0, 0)
    ctx.restore()
  }

  // --- Zoom and pan (unchanged) ---------------------------------------------
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

  // --- Playback control (unchanged API) -------------------------------------
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
    this.imageData = this.ctx.createImageData(this.gridCols, this.gridRows)
    this.pixelData = this.imageData.data
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
    this.render()
    if (wasPlaying && ruleset) this.play(this.lastStepsPerSecond, ruleset)
  }

  // --- Getters (unchanged) --------------------------------------------------
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
