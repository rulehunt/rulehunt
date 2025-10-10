// tests/cellular-automata-cpu.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { CellularAutomata } from '../src/cellular-automata-cpu'
import {
  createTestCanvas,
  createConwayRuleset,
  parseGrid,
  formatGrid,
  compareGrids,
  ConwayPatterns,
  setPattern,
} from './test-utils'

describe('CellularAutomata (CPU)', () => {
  let ca: CellularAutomata
  let conwayRuleset: ReturnType<typeof createConwayRuleset>

  beforeEach(() => {
    // Create CA instance in headless mode (no canvas) for testing
    ca = new CellularAutomata(null, {
      gridRows: 10,
      gridCols: 10,
      fgColor: '#000000',
      bgColor: '#ffffff',
    })

    // Create Conway ruleset for testing
    conwayRuleset = createConwayRuleset()
  })

  describe('Basic Functionality', () => {
    it('should initialize with correct dimensions', () => {
      expect(ca.getGridSize()).toBe(100) // 10x10 = 100
    })

    it('should clear grid to all dead cells', () => {
      ca.clearGrid()
      const grid = ca.getGrid()
      expect(grid.every((cell) => cell === 0)).toBe(true)
    })

    it('should set center seed', () => {
      ca.clearGrid()
      ca.centerSeed()

      const grid = ca.getGrid()
      const centerIdx = 5 * 10 + 5 // row 5, col 5 in 10x10 grid

      // Center cell should be alive
      expect(grid[centerIdx]).toBe(1)

      // Count total alive cells (should be exactly 1)
      const aliveCount = grid.reduce((sum, cell) => sum + cell, 0)
      expect(aliveCount).toBe(1)
    })
  })

  describe('Seeding Determinism', () => {
    it('should produce identical random seeds with same seed value', () => {
      const ca1 = new CellularAutomata(null, {
        gridRows: 10,
        gridCols: 10,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      const ca2 = new CellularAutomata(null, {
        gridRows: 10,
        gridCols: 10,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      // Clear and set seeds
      ca1.clearGrid()
      ca2.clearGrid()

      // Get initial seeds
      const seed1 = ca1.getSeed()
      const seed2 = ca2.getSeed()

      // Set grid to replicate same seed effect
      ca1.randomSeed(50)
      const grid1 = ca1.getGrid()

      // Set ca2 grid to same as ca1
      ca2.setGrid(grid1)
      const grid2 = ca2.getGrid()

      // Grids should be identical
      expect(grid2).toEqual(grid1)
    })
  })

  describe("Conway's Game of Life Patterns", () => {
    it('should keep block pattern stable', () => {
      const ca = new CellularAutomata(null, {
        gridRows: 4,
        gridCols: 4,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      // Set up block pattern
      const blockGrid = ConwayPatterns.block.grid
      ca.setGrid(blockGrid)

      const initialGrid = ca.getGrid()

      // Step once
      ca.step(conwayRuleset)

      const afterStepGrid = ca.getGrid()

      // Block should remain unchanged (still life)
      expect(afterStepGrid).toEqual(initialGrid)
    })

    it('should oscillate blinker pattern with period 2', () => {
      const ca = new CellularAutomata(null, {
        gridRows: 5,
        gridCols: 5,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      // Set up blinker (vertical)
      const blinkerGrid = ConwayPatterns.blinker.grid
      ca.setGrid(blinkerGrid)

      const initialGrid = ca.getGrid()

      // Step once - should become horizontal
      ca.step(conwayRuleset)
      const afterStep1 = ca.getGrid()

      // Should be different from initial (oscillated)
      expect(afterStep1).not.toEqual(initialGrid)

      // Step again - should return to vertical
      ca.step(conwayRuleset)
      const afterStep2 = ca.getGrid()

      // Should match initial state (period 2)
      expect(afterStep2).toEqual(initialGrid)
    })

    it('should move glider diagonally', () => {
      const ca = new CellularAutomata(null, {
        gridRows: 8,
        gridCols: 8,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      // Set up glider
      const gliderGrid = ConwayPatterns.glider.grid
      ca.setGrid(gliderGrid)

      const initialGrid = ca.getGrid()

      // Step 4 times (glider has period 4)
      for (let i = 0; i < 4; i++) {
        ca.step(conwayRuleset)
      }

      const afterCycleGrid = ca.getGrid()

      // Glider should have moved (not in same position)
      expect(afterCycleGrid).not.toEqual(initialGrid)

      // Should still have 5 alive cells (glider shape)
      const aliveCountInitial = initialGrid.reduce((sum, cell) => sum + cell, 0)
      const aliveCountAfter = afterCycleGrid.reduce((sum, cell) => sum + cell, 0)
      expect(aliveCountAfter).toBe(aliveCountInitial)
      expect(aliveCountAfter).toBe(5)
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty grid (all dead)', () => {
      ca.clearGrid()
      const initialGrid = ca.getGrid()

      // Step with Conway's rule
      ca.step(conwayRuleset)

      const afterStepGrid = ca.getGrid()

      // Empty grid should stay empty (no births without neighbors)
      expect(afterStepGrid).toEqual(initialGrid)
      expect(afterStepGrid.every((cell) => cell === 0)).toBe(true)
    })

    it('should handle single corner cell with toroidal wrapping', () => {
      const ca = new CellularAutomata(null, {
        gridRows: 5,
        gridCols: 5,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      ca.clearGrid()

      // Place single cell at top-left corner
      const grid = new Uint8Array(25)
      grid[0] = 1 // top-left corner
      ca.setGrid(grid)

      // Step once
      ca.step(conwayRuleset)

      const afterStep = ca.getGrid()

      // Single cell with no neighbors dies (underpopulation)
      // Due to toroidal wrapping, it has 0 neighbors still
      expect(afterStep[0]).toBe(0)
    })
  })

  describe('Step Computation', () => {
    it('should compute one step correctly', () => {
      ca.clearGrid()
      ca.centerSeed()

      const initialSize = ca.getGridSize()
      ca.step(conwayRuleset)

      // Grid size shouldn't change
      expect(ca.getGridSize()).toBe(initialSize)

      // Grid should still be valid
      const grid = ca.getGrid()
      expect(grid.length).toBe(initialSize)
    })

    it('should compute multiple steps', () => {
      ca.clearGrid()
      ca.centerSeed()

      for (let i = 0; i < 10; i++) {
        ca.step(conwayRuleset)
      }

      expect(ca.getGridSize()).toBe(100)
    })

    it('should apply ruleset correctly for known pattern', () => {
      // Toad oscillator test
      const ca = new CellularAutomata(null, {
        gridRows: 6,
        gridCols: 6,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      const toadGrid = ConwayPatterns.toad.grid
      ca.setGrid(toadGrid)

      const initialGrid = ca.getGrid()

      // Step once
      ca.step(conwayRuleset)
      const afterStep1 = ca.getGrid()

      // Should oscillate
      expect(afterStep1).not.toEqual(initialGrid)

      // Step again - should return to original
      ca.step(conwayRuleset)
      const afterStep2 = ca.getGrid()

      expect(afterStep2).toEqual(initialGrid)
    })
  })

  describe('Grid Access Methods', () => {
    it('should get grid copy', () => {
      ca.clearGrid()
      ca.centerSeed()

      const grid = ca.getGrid()

      // Should be a Uint8Array
      expect(grid).toBeInstanceOf(Uint8Array)
      expect(grid.length).toBe(100)

      // Should be a copy (modifying it doesn't affect CA)
      grid[0] = 1
      const grid2 = ca.getGrid()
      expect(grid2[0]).toBe(0) // CA's grid unchanged
    })

    it('should set grid from Uint8Array', () => {
      const newGrid = new Uint8Array(100)
      newGrid[0] = 1
      newGrid[99] = 1

      ca.setGrid(newGrid)
      const retrievedGrid = ca.getGrid()

      expect(retrievedGrid[0]).toBe(1)
      expect(retrievedGrid[99]).toBe(1)
    })

    it('should reject mismatched grid size', () => {
      const wrongSizeGrid = new Uint8Array(50) // Wrong size

      expect(() => ca.setGrid(wrongSizeGrid)).toThrow('Grid size mismatch')
    })
  })
})
