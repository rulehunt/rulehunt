// tests/test-utils.ts
import type { Ruleset } from '../src/schema'

/**
 * Create a test canvas element for CA testing
 */
export function createTestCanvas(
  width: number,
  height: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

/**
 * Parse grid from ASCII art representation
 * ■ or # = alive (1)
 * □ or . or space = dead (0)
 *
 * Example:
 * ```
 * □ ■ □
 * □ ■ □
 * □ ■ □
 * ```
 */
export function parseGrid(ascii: string): Uint8Array {
  const lines = ascii
    .trim()
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const rows = lines.length
  const cols = lines[0].split(/\s+/).length

  const grid = new Uint8Array(rows * cols)

  for (let y = 0; y < rows; y++) {
    const cells = lines[y].split(/\s+/)
    for (let x = 0; x < cols; x++) {
      const cell = cells[x]
      grid[y * cols + x] = cell === '■' || cell === '#' || cell === '1' ? 1 : 0
    }
  }

  return grid
}

/**
 * Format grid as ASCII art for debugging
 */
export function formatGrid(grid: Uint8Array, cols: number): string {
  const rows = grid.length / cols
  const lines: string[] = []

  for (let y = 0; y < rows; y++) {
    const row: string[] = []
    for (let x = 0; x < cols; x++) {
      const cell = grid[y * cols + x]
      row.push(cell === 1 ? '■' : '□')
    }
    lines.push(row.join(' '))
  }

  return lines.join('\n')
}

/**
 * Compare two grids and return differences
 */
export function compareGrids(
  actual: Uint8Array,
  expected: Uint8Array,
  cols: number,
): string {
  if (actual.length !== expected.length) {
    return `Grid size mismatch: actual ${actual.length}, expected ${expected.length}`
  }

  const diffs: string[] = []
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] !== expected[i]) {
      const x = i % cols
      const y = Math.floor(i / cols)
      diffs.push(
        `(${x},${y}): expected ${expected[i]}, got ${actual[i]}`,
      )
    }
  }

  if (diffs.length === 0) {
    return 'Grids match ✓'
  }

  return `Grids differ at ${diffs.length} cells:\n${diffs.slice(0, 10).join('\n')}${
    diffs.length > 10 ? `\n... and ${diffs.length - 10} more` : ''
  }`
}

/**
 * Known Conway's Game of Life patterns for testing
 */
export const ConwayPatterns = {
  // Block (2×2 still life)
  block: {
    grid: parseGrid(`
      □ □ □ □
      □ ■ ■ □
      □ ■ ■ □
      □ □ □ □
    `),
    cols: 4,
    rows: 4,
    period: 1, // static
    description: 'Block - 2×2 still life',
  },

  // Blinker (period 2 oscillator)
  blinker: {
    grid: parseGrid(`
      □ □ □ □ □
      □ □ ■ □ □
      □ □ ■ □ □
      □ □ ■ □ □
      □ □ □ □ □
    `),
    cols: 5,
    rows: 5,
    period: 2,
    description: 'Blinker - period 2 oscillator',
  },

  // Toad (period 2 oscillator)
  toad: {
    grid: parseGrid(`
      □ □ □ □ □ □
      □ □ □ □ □ □
      □ □ ■ ■ ■ □
      □ ■ ■ ■ □ □
      □ □ □ □ □ □
      □ □ □ □ □ □
    `),
    cols: 6,
    rows: 6,
    period: 2,
    description: 'Toad - period 2 oscillator',
  },

  // Glider (moving pattern)
  glider: {
    grid: parseGrid(`
      □ □ □ □ □ □ □ □
      □ □ ■ □ □ □ □ □
      □ □ □ ■ □ □ □ □
      □ ■ ■ ■ □ □ □ □
      □ □ □ □ □ □ □ □
      □ □ □ □ □ □ □ □
      □ □ □ □ □ □ □ □
      □ □ □ □ □ □ □ □
    `),
    cols: 8,
    rows: 8,
    period: 4, // returns to same shape after 4 steps (moved diagonally)
    description: 'Glider - moving pattern',
  },

  // Empty grid
  empty: {
    grid: new Uint8Array(25).fill(0),
    cols: 5,
    rows: 5,
    period: 1, // stays empty
    description: 'Empty grid',
  },
}

/**
 * Set a grid to a known pattern (centers pattern in grid if needed)
 */
export function setPattern(
  targetGrid: Uint8Array,
  targetCols: number,
  pattern: Uint8Array,
  patternCols: number,
): void {
  const targetRows = targetGrid.length / targetCols
  const patternRows = pattern.length / patternCols

  // Center the pattern
  const offsetX = Math.floor((targetCols - patternCols) / 2)
  const offsetY = Math.floor((targetRows - patternRows) / 2)

  // Clear target grid
  targetGrid.fill(0)

  // Copy pattern into target
  for (let y = 0; y < patternRows; y++) {
    for (let x = 0; x < patternCols; x++) {
      const srcIdx = y * patternCols + x
      const dstIdx = (y + offsetY) * targetCols + (x + offsetX)
      if (dstIdx >= 0 && dstIdx < targetGrid.length) {
        targetGrid[dstIdx] = pattern[srcIdx]
      }
    }
  }
}
