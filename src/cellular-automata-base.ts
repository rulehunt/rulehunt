import type { CellularAutomataOptions } from './cellular-automata-interface.ts'
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
    Number.parseInt(h.slice(0, 2), 16),
    Number.parseInt(h.slice(2, 4), 16),
    Number.parseInt(h.slice(4, 6), 16),
  ]
}

/**
 * Base class for cellular automata implementations.
 * Handles all common functionality: rendering, zoom/pan, playback, seeding.
 * Subclasses only implement the actual CA step computation.
 */
export abstract class CellularAutomataBase {
  protected grid: Uint8Array
  protected canvas: HTMLCanvasElement
  protected ctx: CanvasRenderingContext2D
  protected statistics: StatisticsTracker
  protected gridRows: number
  protected gridCols: number
  protected gridArea: number
  protected fgColor: string
  protected bgColor: string
  protected fgRGB: [number, number, number]
  protected bgRGB: [number, number, number]
  protected imageData: ImageData
  protected pixelData: Uint8ClampedArray

  protected seed = Math.floor(Math.random() * 0xffffffff)
  protected rng = makeRng(this.seed)
  protected lastSeedMethod: 'center' | 'random' | 'patch' = 'random'
  protected lastAlivePercentage = 50

  protected currentRuleset: Ruleset | null = null
  protected lastStepsPerSecond = 10
  protected isPlaying = false
  protected playInterval: number | null = null

  protected zoom = 1
  protected panX = 0
  protected panY = 0

  constructor(canvas: HTMLCanvasElement, options: CellularAutomataOptions) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: false,
    }) as CanvasRenderingContext2D

    this.gridRows = options.gridRows
    this.gridCols = options.gridCols
    this.gridArea = this.gridRows * this.gridCols
    this.fgColor = options.fgColor
    this.bgColor = options.bgColor
    this.fgRGB = hexToRGB(this.fgColor)
    this.bgRGB = hexToRGB(this.bgColor)

    this.grid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    this.imageData = this.ctx.createImageData(this.gridCols, this.gridRows)
    this.pixelData = this.imageData.data
  }

  // --- Abstract methods (implemented by subclasses) -------------------------
  /**
   * Compute one CA step using the given ruleset.
   * Implementation must update this.grid to reflect the next generation.
   *
   * @param ruleset The ruleset defining cell behavior (512 entries for 3x3 neighborhoods)
   */
  protected abstract computeStep(ruleset: Ruleset): void

  /**
   * Called after this.grid is modified by seeding operations.
   * Subclasses should sync any internal state that mirrors the grid.
   *
   * Example: GPU implementation syncs to grid2D array, CPU does nothing.
   */
  protected abstract onGridChanged(): void

  /**
   * Cleanup engine-specific resources.
   * Called before grid resize and during destruction.
   *
   * Example: GPU implementation destroys kernels, CPU reallocates buffers.
   */
  protected abstract cleanup(): void

  // --- Seeding (common to all implementations) ------------------------------
  setColors(fgColor: string, bgColor: string) {
    this.fgColor = fgColor
    this.bgColor = bgColor
    this.fgRGB = hexToRGB(fgColor)
    this.bgRGB = hexToRGB(bgColor)
  }

  /** Explicitly clear the visible canvas to the background color */
  protected clearCanvas(): void {
    const ctx = this.ctx
    if (!ctx) return
    ctx.save()
    ctx.fillStyle = this.bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.restore()
  }

  clearGrid() {
    this.clearCanvas()
    this.grid.fill(0)
    this.onGridChanged()
  }

  centerSeed() {
    this.clearGrid()
    const cx = Math.floor(this.gridCols / 2)
    const cy = Math.floor(this.gridRows / 2)
    this.grid[cy * this.gridCols + cx] = 1
    this.lastSeedMethod = 'center'
    this.onGridChanged()
  }

  randomSeed(alivePercentage = 50) {
    this.rng = makeRng(this.seed)
    const threshold = alivePercentage / 100
    for (let i = 0; i < this.grid.length; i++) {
      this.grid[i] = this.rng() < threshold ? 1 : 0
    }
    this.lastSeedMethod = 'random'
    this.lastAlivePercentage = alivePercentage
    this.onGridChanged()
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

    // Generate initial random noise
    for (let dy = 0; dy < patch; dy++) {
      for (let dx = 0; dx < patch; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
          this.grid[y * this.gridCols + x] = this.rng() < threshold ? 1 : 0
        }
      }
    }

    // Smoothing pass: keep alive cells that have at least 2 alive neighbors
    const smoothed = new Array(this.grid.length).fill(0)
    for (let dy = 0; dy < patch; dy++) {
      for (let dx = 0; dx < patch; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
          const idx = y * this.gridCols + x

          // Count neighbors
          let neighbors = 0
          for (let ny = -1; ny <= 1; ny++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && ny === 0) continue
              const checkX = x + nx
              const checkY = y + ny
              if (
                checkX >= 0 &&
                checkX < this.gridCols &&
                checkY >= 0 &&
                checkY < this.gridRows
              ) {
                neighbors += this.grid[checkY * this.gridCols + checkX]
              }
            }
          }

          // Keep alive if it has 2+ neighbors, or convert dead to alive if 4+ neighbors
          smoothed[idx] =
            (this.grid[idx] === 1 && neighbors >= 2) || neighbors >= 4 ? 1 : 0
        }
      }
    }

    // Copy smoothed result back
    for (let dy = 0; dy < patch; dy++) {
      for (let dx = 0; dx < patch; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
          this.grid[y * this.gridCols + x] = smoothed[y * this.gridCols + x]
        }
      }
    }

    this.lastSeedMethod = 'patch'
    this.lastAlivePercentage = alivePercentage
    this.onGridChanged()
  }

  // --- Simulation step (calls subclass implementation) ----------------------
  step(ruleset: Ruleset) {
    this.computeStep(ruleset)
    this.statistics.recordStep(this.grid)
    this.render()
  }

  // --- Rendering (common to all implementations) ----------------------------
  render() {
    const data = this.pixelData
    const grid = this.grid
    const [fr, fg, fb] = this.fgRGB
    const [br, bg, bb] = this.bgRGB
    const len = grid.length

    // Unrolled loop for performance
    let i = 0
    let j = 0
    const len4 = len - (len % 4)

    for (; i < len4; i += 4, j += 16) {
      // Cell 0
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

      // Cell 1
      if (grid[i + 1]) {
        data[j + 4] = fr
        data[j + 5] = fg
        data[j + 6] = fb
      } else {
        data[j + 4] = br
        data[j + 5] = bg
        data[j + 6] = bb
      }
      data[j + 7] = 255

      // Cell 2
      if (grid[i + 2]) {
        data[j + 8] = fr
        data[j + 9] = fg
        data[j + 10] = fb
      } else {
        data[j + 8] = br
        data[j + 9] = bg
        data[j + 10] = bb
      }
      data[j + 11] = 255

      // Cell 3
      if (grid[i + 3]) {
        data[j + 12] = fr
        data[j + 13] = fg
        data[j + 14] = fb
      } else {
        data[j + 12] = br
        data[j + 13] = bg
        data[j + 14] = bb
      }
      data[j + 15] = 255
    }

    // Remainder
    for (; i < len; i++, j += 4) {
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

    const ctx = this.ctx
    ctx.save()
    ctx.fillStyle = this.bgColor
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.translate(this.panX, this.panY)
    ctx.scale(this.zoom, this.zoom)
    ctx.putImageData(this.imageData, 0, 0)
    ctx.restore()
  }

  // --- Zoom and pan (common to all implementations) -------------------------
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

  // --- Playback control (common to all implementations) ---------------------
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

  /** Lightweight deterministic 32-bit hash (FNV-1a) */
  fnv1a32(seed: number): number {
    let hash = 0x811c9dc5
    for (let i = 0; i < 4; i++) {
      hash ^= (seed >>> (i * 8)) & 0xff
      hash = Math.imul(hash, 0x01000193)
    }
    return hash >>> 0
  }

  softReset() {
    // Deterministic hash-chain evolution
    this.seed = this.fnv1a32(this.seed)
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

    this.grid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)
    this.imageData = this.ctx.createImageData(this.gridCols, this.gridRows)
    this.pixelData = this.imageData.data

    // Let subclass clean up engine-specific resources
    this.cleanup()

    this.clearCanvas()

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

  // --- Getters (common to all implementations) ------------------------------
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
  destroy() {
    this.pause()
    // Subclasses can override to clean up engine-specific resources
    this.cleanup()
  }
}
