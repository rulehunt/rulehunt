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
  protected canvas: HTMLCanvasElement | null
  protected ctx: CanvasRenderingContext2D | null
  protected statistics: StatisticsTracker
  protected gridRows: number
  protected gridCols: number
  protected gridArea: number
  protected fgColor: string
  protected bgColor: string
  protected fgRGB: [number, number, number]
  protected bgRGB: [number, number, number]
  protected imageData: ImageData | null
  protected pixelData: Uint8ClampedArray | null

  protected seed = Math.floor(Math.random() * 0xffffffff)
  protected rng = makeRng(this.seed)
  protected lastSeedMethod: 'center' | 'random' | 'patch' = 'random'
  protected lastAlivePercentage = 50

  protected currentRuleset: Ruleset | null = null
  protected lastStepsPerSecond = 10
  protected isPlaying = false
  protected playInterval: number | null = null

  protected zoomLevel = 1
  protected displayZoom = 1

  constructor(
    canvas: HTMLCanvasElement | null,
    options: CellularAutomataOptions,
  ) {
    this.canvas = canvas
    this.ctx = canvas
      ? (canvas.getContext('2d', {
          alpha: false,
          willReadFrequently: false,
        }) as CanvasRenderingContext2D)
      : null

    this.gridRows = options.gridRows
    this.gridCols = options.gridCols
    this.gridArea = this.gridRows * this.gridCols
    this.fgColor = options.fgColor
    this.bgColor = options.bgColor
    this.fgRGB = hexToRGB(this.fgColor)
    this.bgRGB = hexToRGB(this.bgColor)

    this.grid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    if (this.ctx) {
      this.imageData = this.ctx.createImageData(this.gridCols, this.gridRows)
      this.pixelData = this.imageData.data
    } else {
      this.imageData = null
      this.pixelData = null
    }
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
    const canvas = this.canvas
    if (!ctx || !canvas) return
    ctx.save()
    ctx.fillStyle = this.bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
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

  patchSeed() {
    this.rng = makeRng(this.seed)
    this.clearGrid()

    // Draw between ~10% and ~70% alive fraction
    const alivePercentage = 10 + Math.floor(this.rng() * 60)

    const cx = Math.floor(this.gridCols / 2)
    const cy = Math.floor(this.gridRows / 2)
    const patch = 100
    const startX = cx - Math.floor(patch / 2)
    const startY = cy - Math.floor(patch / 2)
    const threshold = alivePercentage / 100

    // --- 1️⃣ Deterministic parameter generation ---
    const noiseScale = 4 + Math.floor(this.rng() * 12)
    const motifOptions = ['ring', 'plus', 'cross', 'checker', 'blob']
    const motif = motifOptions[Math.floor(this.rng() * motifOptions.length)]
    const doSmooth = this.rng() < 0.8 // 80% chance to smooth
    const invert = this.rng() < 0.2 // 20% chance to invert pattern
    const secondaryMotifChance = this.rng() * 0.6 // up to 60% chance of 2nd motif

    // --- 2️⃣ Base low-frequency noise ---
    for (let y = 0; y < patch; y++) {
      for (let x = 0; x < patch; x++) {
        const gx = startX + x
        const gy = startY + y
        const val =
          (Math.sin(x / noiseScale + this.rng() * Math.PI) +
            Math.sin(y / noiseScale + this.rng() * Math.PI)) /
          2
        const alive = val + this.rng() * 0.4 > 1 - threshold ? 1 : 0
        this.grid[gy * this.gridCols + gx] = invert ? 1 - alive : alive
      }
    }

    // --- Helper to safely draw ---
    const draw = (x: number, y: number) => {
      if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows)
        this.grid[y * this.gridCols + x] = 1
    }

    // --- 3️⃣ Deterministic motif placement ---
    const drawMotif = (type: string) => {
      switch (type) {
        case 'ring': {
          const r = 10 + Math.floor(this.rng() * 30)
          for (let a = 0; a < 2 * Math.PI; a += 0.02) {
            draw(
              Math.round(cx + r * Math.cos(a)),
              Math.round(cy + r * Math.sin(a)),
            )
          }
          break
        }
        case 'plus': {
          const arm = 10 + Math.floor(this.rng() * 30)
          for (let d = -arm; d <= arm; d++) {
            draw(cx + d, cy)
            draw(cx, cy + d)
          }
          break
        }
        case 'cross': {
          const arm = 10 + Math.floor(this.rng() * 30)
          for (let d = -arm; d <= arm; d++) {
            draw(cx + d, cy + d)
            draw(cx + d, cy - d)
          }
          break
        }
        case 'checker': {
          const step = 2 + Math.floor(this.rng() * 4)
          for (let y = 0; y < patch; y++) {
            for (let x = 0; x < patch; x++) {
              if ((x + y) % step === 0) draw(startX + x, startY + y)
            }
          }
          break
        }
        case 'blob': {
          const count = 10 + Math.floor(this.rng() * 50)
          for (let i = 0; i < count; i++) {
            const bx = cx + Math.floor(this.rng() * 60 - 30)
            const by = cy + Math.floor(this.rng() * 60 - 30)
            const r = 2 + Math.floor(this.rng() * 5)
            for (let dy = -r; dy <= r; dy++) {
              for (let dx = -r; dx <= r; dx++) {
                if (dx * dx + dy * dy <= r * r) draw(bx + dx, by + dy)
              }
            }
          }
          break
        }
      }
    }

    drawMotif(motif)
    if (this.rng() < secondaryMotifChance) {
      const m2 = motifOptions[Math.floor(this.rng() * motifOptions.length)]
      drawMotif(m2)
    }

    // --- 4️⃣ Optional smoothing pass ---
    if (doSmooth) {
      const smoothed = new Array(this.grid.length).fill(0)
      for (let y = startY; y < startY + patch; y++) {
        for (let x = startX; x < startX + patch; x++) {
          let neighbors = 0
          for (let ny = -1; ny <= 1; ny++) {
            for (let nx = -1; nx <= 1; nx++) {
              if (nx === 0 && ny === 0) continue
              const gx = x + nx
              const gy = y + ny
              if (
                gx >= 0 &&
                gx < this.gridCols &&
                gy >= 0 &&
                gy < this.gridRows
              )
                neighbors += this.grid[gy * this.gridCols + gx]
            }
          }
          const idx = y * this.gridCols + x
          smoothed[idx] =
            (this.grid[idx] === 1 && neighbors >= 2) || neighbors >= 4 ? 1 : 0
        }
      }
      for (let y = startY; y < startY + patch; y++) {
        for (let x = startX; x < startX + patch; x++) {
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

  setZoom(level: number) {
    this.zoomLevel = Math.max(1, Math.min(100, level))
    this.render() // re-render immediately
  }

  getZoom(): number {
    return this.zoomLevel
  }

  // --- Rendering (zoom-aware, optimized) ------------------------------------
  render() {
    const ctx = this.ctx
    const data = this.pixelData
    const imageData = this.imageData

    // Skip rendering if no canvas is attached (headless mode for testing)
    if (!ctx || !data || !imageData) return

    const grid = this.grid
    const [fr, fg, fb] = this.fgRGB
    const [br, bg, bb] = this.bgRGB

    this.displayZoom += (this.zoomLevel - this.displayZoom) * 0.5
    const zoom = this.displayZoom

    // Visible window centered around grid midpoint
    const centerX = Math.floor(this.gridCols / 2)
    const centerY = Math.floor(this.gridRows / 2)
    const visibleCols = Math.max(1, Math.floor(this.gridCols / zoom))
    const visibleRows = Math.max(1, Math.floor(this.gridRows / zoom))
    const startX = Math.max(0, centerX - Math.floor(visibleCols / 2))
    const startY = Math.max(0, centerY - Math.floor(visibleRows / 2))

    // Target canvas resolution
    const outW = imageData.width
    const outH = imageData.height
    const scaleX = visibleCols / outW
    const scaleY = visibleRows / outH

    // For each output pixel, sample from zoom window
    let j = 0
    for (let y = 0; y < outH; y++) {
      const gy = startY + Math.floor(y * scaleY)
      const rowOffset = gy * this.gridCols
      for (let x = 0; x < outW; x++, j += 4) {
        const gx = startX + Math.floor(x * scaleX)
        const idx = rowOffset + gx
        const alive = grid[idx]

        if (alive) {
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
    }

    ctx.putImageData(imageData, 0, 0)
  }

  // --- Playback control (common to all implementations) ---------------------
  play(stepsPerSecond: number, ruleset?: Ruleset) {
    if (this.isPlaying) return

    this.currentRuleset = ruleset || this.currentRuleset
    if (!this.currentRuleset) return
    const active_ruleset = this.currentRuleset

    this.lastStepsPerSecond = stepsPerSecond
    this.isPlaying = true
    const intervalMs = 1000 / stepsPerSecond
    this.playInterval = window.setInterval(() => {
      this.step(active_ruleset)
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
        this.patchSeed()
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

    if (this.canvas) {
      this.canvas.width = this.canvas.clientWidth
      this.canvas.height = this.canvas.clientHeight
    }

    this.gridRows = newRows
    this.gridCols = newCols
    this.gridArea = newRows * newCols

    this.grid = new Uint8Array(this.gridArea)
    this.statistics = new StatisticsTracker(this.gridRows, this.gridCols)

    if (this.ctx) {
      this.imageData = this.ctx.createImageData(this.gridCols, this.gridRows)
      this.pixelData = this.imageData.data
    }

    // Let subclass clean up engine-specific resources
    this.cleanup()

    this.clearCanvas()

    switch (this.lastSeedMethod) {
      case 'center':
        this.centerSeed()
        break
      case 'patch':
        this.patchSeed()
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

  getCurrentRuleset() {
    return this.currentRuleset
  }
  getLastStepsPerSecond() {
    return this.lastStepsPerSecond
  }
  isRunning() {
    return this.isPlaying
  }

  // --- Grid access for testing ----------------------------------------------
  /**
   * Get a copy of the current grid state.
   * Primarily for testing and debugging.
   */
  getGrid(): Uint8Array {
    return new Uint8Array(this.grid)
  }

  /**
   * Set the grid state directly.
   * Primarily for testing - allows setting up specific patterns.
   * @param newGrid - Grid data to copy (must match grid dimensions)
   */
  setGrid(newGrid: Uint8Array): void {
    if (newGrid.length !== this.gridArea) {
      throw new Error(
        `Grid size mismatch: expected ${this.gridArea}, got ${newGrid.length}`,
      )
    }
    this.grid.set(newGrid)
    this.onGridChanged()
  }
}
