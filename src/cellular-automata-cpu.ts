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
  private neighborOffsets: number[]

  constructor(canvas: HTMLCanvasElement, options: CellularAutomataOptions) {
    super(canvas, options)

    this.nextGrid = new Uint8Array(this.gridArea)

    // Precompute neighbor offsets for the 3x3 kernel
    const c = this.gridCols
    this.neighborOffsets = [-c - 1, -c, -c + 1, -1, 0, 1, c - 1, c, c + 1]

    this.randomSeed()
  }

  protected computeStep(ruleset: Ruleset) {
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

    // Recompute offsets in case grid dimensions changed
    const c = this.gridCols
    this.neighborOffsets = [-c - 1, -c, -c + 1, -1, 0, 1, c - 1, c, c + 1]
  }
}
