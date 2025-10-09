import { GPU, type IKernelRunShortcut, type Texture } from 'gpu.js'
import { CellularAutomataBase } from './cellular-automata-base.ts'
import type {
  CellularAutomataOptions,
  ICellularAutomata,
} from './cellular-automata-interface.ts'
import type { Ruleset } from './schema.ts'

interface NavigatorWithMemory extends Navigator {
  deviceMemory?: number
}

function getOptimalBatchSize(): number {
  const memory = (navigator as NavigatorWithMemory).deviceMemory || 4
  const cores = navigator.hardwareConcurrency || 4
  if (memory >= 8 && cores >= 8) return 10
  if (memory >= 4 && cores >= 4) return 7
  return 5
}

export class GPUCellularAutomata
  extends CellularAutomataBase
  implements ICellularAutomata
{
  private gpu: GPU
  private stepKernel: IKernelRunShortcut | null = null
  private grid2D: number[][]
  private cachedRuleset: number[] | null = null
  private cachedRulesetRef: Ruleset | null = null
  private batchSize: number

  constructor(canvas: HTMLCanvasElement, options: CellularAutomataOptions) {
    super(canvas, options)

    this.gpu = new GPU({ mode: 'gpu' })
    this.batchSize = getOptimalBatchSize()
    this.grid2D = Array.from({ length: this.gridRows }, () =>
      new Array(this.gridCols).fill(0),
    )

    this.randomSeed()

    // ✅ NEW (proper multiplication sign):
    console.log(
      `[GPU] Batch: ${this.batchSize}, Grid: ${this.gridCols} x ${this.gridRows}`,
    )
  }
  private createStepKernel(): IKernelRunShortcut {
    return this.gpu
      .createKernel(function (grid: number[][], ruleset: number[]) {
        const x = this.thread.x as number
        const y = this.thread.y as number
        const cols = this.constants.cols as number
        const rows = this.constants.rows as number

        const xm1 = (x - 1 + cols) % cols
        const xp1 = (x + 1) % cols
        const ym1 = (y - 1 + rows) % rows
        const yp1 = (y + 1) % rows

        // --- Helper: numeric-safe "alive" indicator ---
        function alive(v: number): number {
          return v > 0.5 ? 1 : 0
        }

        // --- Compute orbit index deterministically ---
        const index =
          alive(grid[ym1][xm1]) +
          alive(grid[ym1][x]) * 2 +
          alive(grid[ym1][xp1]) * 4 +
          alive(grid[y][xm1]) * 8 +
          alive(grid[y][x]) * 16 +
          alive(grid[y][xp1]) * 32 +
          alive(grid[yp1][xm1]) * 64 +
          alive(grid[yp1][x]) * 128 +
          alive(grid[yp1][xp1]) * 256

        return ruleset[index]
      })
      .setOutput([this.gridCols, this.gridRows])
      .setConstants({ cols: this.gridCols, rows: this.gridRows })
      .setPipeline(true)
      .setImmutable(true)
      .setPrecision('single') // keep: avoids float16 issues on Safari
  }

  private syncFrom2D(output: number[][]) {
    let idx = 0
    for (let y = 0; y < this.gridRows; y++) {
      const row = output[y]
      for (let x = 0; x < this.gridCols; x++) {
        const val = row[x] > 0.5 ? 1 : 0
        this.grid[idx] = val
        this.grid2D[y][x] = val
        idx++
      }
    }
  }

  private getRulesetArray(ruleset?: Ruleset): number[] {
    if (!ruleset) {
      return this.cachedRuleset ?? []
    }

    if (this.cachedRulesetRef === ruleset && this.cachedRuleset) {
      return this.cachedRuleset
    }

    this.cachedRuleset = Array.from(ruleset)
    this.cachedRulesetRef = ruleset
    return this.cachedRuleset
  }

  protected computeStep(ruleset: Ruleset) {
    if (!this.stepKernel) {
      this.stepKernel = this.createStepKernel()
    }

    const rulesetArray = this.getRulesetArray(ruleset)
    const result = this.stepKernel(this.grid2D, rulesetArray)
    const output = (result as Texture).toArray() as number[][]

    this.syncFrom2D(output)
  }

  protected onGridChanged() {
    // Sync grid -> grid2D
    let idx = 0
    for (let y = 0; y < this.gridRows; y++) {
      const row = this.grid2D[y]
      for (let x = 0; x < this.gridCols; x++) {
        row[x] = this.grid[idx++]
      }
    }
  }

  protected cleanup() {
    this.cachedRuleset = null
    this.cachedRulesetRef = null
    if (this.stepKernel) {
      this.stepKernel.destroy()
      this.stepKernel = null
    }
    this.grid2D = Array.from({ length: this.gridRows }, () =>
      new Array(this.gridCols).fill(0),
    )
  }

  // Override play() for GPU batching
  play(stepsPerSecond: number, ruleset: Ruleset) {
    if (this.isPlaying) return
    this.currentRuleset = ruleset
    this.lastStepsPerSecond = stepsPerSecond
    this.isPlaying = true

    const interval = (1000 / stepsPerSecond) * this.batchSize
    this.playInterval = window.setInterval(() => {
      this.stepBatch(this.batchSize, ruleset)
    }, interval)
  }

  private stepBatch(count: number, ruleset: Ruleset) {
    if (!this.stepKernel) {
      this.stepKernel = this.createStepKernel()
    }

    const rulesetArray = this.getRulesetArray(ruleset)
    let result = this.stepKernel(this.grid2D, rulesetArray)

    for (let i = 1; i < count; i++) {
      result = this.stepKernel(result, rulesetArray)
    }

    const output = (result as Texture).toArray() as number[][]
    this.syncFrom2D(output)

    this.statistics.recordStep(this.grid)
    this.render()
  }

  override destroy() {
    super.destroy() // Calls pause() and cleanup()
    this.gpu.destroy()
  }
}
