import { CellularAutomataBase } from './cellular-automata-base.ts'
import type {
  CellularAutomataOptions,
  ICellularAutomata,
} from './cellular-automata-interface.ts'
import type { Ruleset } from './schema.ts'

export class CellularAutomata
  extends CellularAutomataBase
  implements ICellularAutomata
{
  private nextGrid: Uint8Array

  constructor(
    canvas: HTMLCanvasElement | null,
    options: CellularAutomataOptions,
  ) {
    super(canvas, options)

    this.nextGrid = new Uint8Array(this.gridArea)

    this.randomSeed()
  }

  protected computeStep(ruleset: Ruleset) {
    const cols = this.gridCols
    const rows = this.gridRows
    const grid = this.grid
    const next = this.nextGrid

    // 3x3 neighborhood offsets in reading order (top-left to bottom-right)
    const dx = [-1, 0, 1, -1, 0, 1, -1, 0, 1]
    const dy = [-1, -1, -1, 0, 0, 0, 1, 1, 1]

    for (let y = 0; y < rows; y++) {
      const yOffset = y * cols
      for (let x = 0; x < cols; x++) {
        let index = 0
        let bit = 0
        for (let k = 0; k < 9; k++) {
          const nx = (x + dx[k] + cols) % cols
          const ny = (y + dy[k] + rows) % rows
          if (grid[ny * cols + nx]) index |= 1 << bit
          bit++
        }
        next[yOffset + x] = ruleset[index]
      }
    }

    // Swap grids
    const tmp = this.grid
    this.grid = this.nextGrid
    this.nextGrid = tmp
  }

  protected onGridChanged() {
    // No special sync needed for CPU implementation
  }

  protected cleanup() {
    this.nextGrid = new Uint8Array(this.gridArea)
  }

  /**
   * No-op for CPU (grid is always in sync).
   * Exists for API compatibility with GPU implementation.
   */
  public syncToHost() {
    // CPU grid is always synced - nothing to do
  }
}
