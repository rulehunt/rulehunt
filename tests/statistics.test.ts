import { describe, expect, it, beforeEach } from 'vitest'
import { StatisticsTracker } from '../src/statistics'
import type { GridStatistics } from '../src/statistics'

describe('StatisticsTracker', () => {
  describe('Constructor and Initialization', () => {
    it('should initialize with correct grid dimensions', () => {
      const tracker = new StatisticsTracker(100, 100)
      expect(tracker).toBeDefined()
    })

    it('should handle small grids', () => {
      const tracker = new StatisticsTracker(10, 10)
      expect(tracker).toBeDefined()
    })

    it('should handle large grids', () => {
      const tracker = new StatisticsTracker(1000, 1000)
      expect(tracker).toBeDefined()
    })
  })

  describe('initializeSimulation', () => {
    it('should set metadata correctly', () => {
      const tracker = new StatisticsTracker(50, 50)
      tracker.initializeSimulation({
        name: 'Test Sim',
        seedType: 'random',
        seedPercentage: 50,
        rulesetName: 'Test Rule',
        rulesetHex: 'abc123',
        startTime: Date.now(),
        requestedStepsPerSecond: 10,
      })

      const metadata = tracker.getMetadata()
      expect(metadata).toBeDefined()
      expect(metadata?.name).toBe('Test Sim')
      expect(metadata?.stepCount).toBe(0)
    })

    it('should reset history on re-initialization', () => {
      const tracker = new StatisticsTracker(50, 50)
      const grid = new Uint8Array(2500)

      tracker.initializeSimulation({
        name: 'First',
        seedType: 'random',
        rulesetName: 'Rule1',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })
      tracker.recordStep(grid)
      tracker.recordStep(grid)

      expect(tracker.getRecentStats(10).length).toBe(2)

      tracker.initializeSimulation({
        name: 'Second',
        seedType: 'center',
        rulesetName: 'Rule2',
        rulesetHex: 'def',
        startTime: Date.now(),
      })

      expect(tracker.getRecentStats(10).length).toBe(0)
    })
  })

  describe('calculatePopulation', () => {
    it('should return 0 for empty grid', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.population).toBe(0)
    })

    it('should return full count for filled grid', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100).fill(1)
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.population).toBe(100)
    })

    it('should count correctly for partially filled grid', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)
      // Set first 25 cells to 1
      for (let i = 0; i < 25; i++) {
        grid[i] = 1
      }
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.population).toBe(25)
    })
  })

  describe('calculateActivity', () => {
    it('should return 0 for initial state (no previous grid)', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100).fill(1)
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.activity).toBe(0)
    })

    it('should return 0 for identical consecutive grids', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid1 = new Uint8Array(100).fill(1)
      const grid2 = new Uint8Array(100).fill(1)

      tracker.recordInitialState(grid1)
      tracker.recordStep(grid2)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.activity).toBe(0)
    })

    it('should count all changed cells', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid1 = new Uint8Array(100)
      const grid2 = new Uint8Array(100)

      // Change 10 cells
      for (let i = 0; i < 10; i++) {
        grid1[i] = 0
        grid2[i] = 1
      }

      tracker.recordInitialState(grid1)
      tracker.recordStep(grid2)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.activity).toBe(10)
    })

    it('should count bidirectional changes (0->1 and 1->0)', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid1 = new Uint8Array(100)
      const grid2 = new Uint8Array(100)

      // 5 cells: 0 -> 1
      for (let i = 0; i < 5; i++) {
        grid1[i] = 0
        grid2[i] = 1
      }

      // 5 cells: 1 -> 0
      for (let i = 5; i < 10; i++) {
        grid1[i] = 1
        grid2[i] = 0
      }

      tracker.recordInitialState(grid1)
      tracker.recordStep(grid2)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.activity).toBe(10) // Total changes
    })
  })

  describe('calculatePopulationChange', () => {
    it('should return 0 for initial state', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100).fill(1)
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.populationChange).toBe(0)
    })

    it('should track positive population change', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid1 = new Uint8Array(100)
      const grid2 = new Uint8Array(100)

      // grid1: 10 alive, grid2: 20 alive
      for (let i = 0; i < 10; i++) grid1[i] = 1
      for (let i = 0; i < 20; i++) grid2[i] = 1

      tracker.recordInitialState(grid1)
      tracker.recordStep(grid2)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.populationChange).toBe(10)
    })

    it('should track negative population change', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid1 = new Uint8Array(100)
      const grid2 = new Uint8Array(100)

      // grid1: 20 alive, grid2: 10 alive
      for (let i = 0; i < 20; i++) grid1[i] = 1
      for (let i = 0; i < 10; i++) grid2[i] = 1

      tracker.recordInitialState(grid1)
      tracker.recordStep(grid2)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.populationChange).toBe(-10)
    })
  })

  describe('calculateBlockEntropy', () => {
    it('should return 0 for uniform pattern (all zeros)', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100) // All zeros
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.entropy2x2).toBe(0)
      expect(stats.entropy4x4).toBe(0)
      expect(stats.entropy8x8).toBe(0)
    })

    it('should return 0 for uniform pattern (all ones)', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100).fill(1)
      tracker.recordInitialState(grid)

      const stats = tracker.getRecentStats(1)[0]
      expect(stats.entropy2x2).toBe(0)
      expect(stats.entropy4x4).toBe(0)
      expect(stats.entropy8x8).toBe(0)
    })

    it('should return higher entropy for random-like pattern', () => {
      const tracker = new StatisticsTracker(20, 20)
      const grid = new Uint8Array(400)

      // Create checkerboard pattern (high entropy)
      for (let y = 0; y < 20; y++) {
        for (let x = 0; x < 20; x++) {
          grid[y * 20 + x] = (x + y) % 2
        }
      }

      tracker.recordInitialState(grid)
      const stats = tracker.getRecentStats(1)[0]

      // Checkerboard should have non-zero entropy
      expect(stats.entropy2x2).toBeGreaterThan(0)
    })

    it('should handle grids smaller than block size', () => {
      const tracker = new StatisticsTracker(5, 5)
      const grid = new Uint8Array(25)
      for (let i = 0; i < 25; i++) grid[i] = i % 2

      tracker.recordInitialState(grid)
      const stats = tracker.getRecentStats(1)[0]

      // 8x8 entropy should be 0 for 5x5 grid (no blocks fit)
      expect(stats.entropy8x8).toBe(0)
      expect(stats.entropy2x2).toBeGreaterThanOrEqual(0)
    })
  })

  describe('recordStep', () => {
    it('should maintain history up to maxHistory', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Record 150 steps (more than maxHistory of 100)
      for (let i = 0; i < 150; i++) {
        grid[i % 100] = 1 // Change something each step
        tracker.recordStep(grid)
      }

      const history = tracker.getRecentStats(200)
      expect(history.length).toBeLessThanOrEqual(100)
    })

    it('should increment stepCount in metadata', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      tracker.recordStep(grid)
      tracker.recordStep(grid)
      tracker.recordStep(grid)

      const metadata = tracker.getMetadata()
      expect(metadata?.stepCount).toBe(3)
    })

    it('should update lastStepTime', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      const beforeTime = Date.now()
      tracker.recordStep(grid)
      const afterTime = Date.now()

      const metadata = tracker.getMetadata()
      expect(metadata?.lastStepTime).toBeGreaterThanOrEqual(beforeTime)
      expect(metadata?.lastStepTime).toBeLessThanOrEqual(afterTime)
    })

    it('should track step times for SPS calculation', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      tracker.recordStep(grid)
      tracker.recordStep(grid)

      const sps = tracker.getActualStepsPerSecond()
      expect(sps).toBeGreaterThanOrEqual(0)
    })
  })

  describe('calculateInterestScore', () => {
    it('should return 0 for complete die-out (population < 0.01)', () => {
      const tracker = new StatisticsTracker(100, 100)
      const grid = new Uint8Array(10000)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Record 20 steps with nearly empty grid (< 0.01% = 1 cell out of 10000)
      for (let i = 0; i < 20; i++) {
        tracker.recordStep(grid)
      }

      const score = tracker.calculateInterestScore()
      expect(score).toBe(0)
    })

    it('should return 0 for complete fill (population > 0.95)', () => {
      const tracker = new StatisticsTracker(100, 100)
      const grid = new Uint8Array(10000).fill(1)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Record 20 steps with completely filled grid
      for (let i = 0; i < 20; i++) {
        tracker.recordStep(grid)
      }

      const score = tracker.calculateInterestScore()
      expect(score).toBe(0)
    })

    it('should return higher score for Goldilocks zone (0.1 < pop < 0.7)', () => {
      const tracker = new StatisticsTracker(100, 100)
      const grid = new Uint8Array(10000)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Fill 30% of grid (in Goldilocks zone)
      for (let i = 0; i < 3000; i++) {
        grid[i] = 1
      }

      // Record 20 steps with activity (change some cells each step)
      for (let step = 0; step < 20; step++) {
        // Toggle some cells to create activity
        const offset = step % 100
        for (let i = 0; i < 50; i++) {
          grid[offset + i] = 1 - grid[offset + i]
        }
        tracker.recordStep(grid)
      }

      const score = tracker.calculateInterestScore()
      expect(score).toBeGreaterThan(0)
    })

    it('should reward high entropy at multiple scales', () => {
      const tracker = new StatisticsTracker(40, 40)
      const grid = new Uint8Array(1600)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Create checkerboard pattern (high entropy)
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          grid[y * 40 + x] = (x + y) % 2
        }
      }

      // Record 20 steps with high entropy pattern
      for (let step = 0; step < 20; step++) {
        // Rotate pattern slightly for activity
        const offset = step % 2
        for (let i = 0; i < 1600; i++) {
          grid[i] = (i + offset) % 2
        }
        tracker.recordStep(grid)
      }

      const score = tracker.calculateInterestScore()
      expect(score).toBeGreaterThan(0)
    })

    it('should penalize static patterns (low activity)', () => {
      const tracker = new StatisticsTracker(100, 100)
      const grid = new Uint8Array(10000)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Fill 30% (Goldilocks zone) but with NO activity
      for (let i = 0; i < 3000; i++) {
        grid[i] = 1
      }

      // Record 20 steps with ZERO activity
      for (let i = 0; i < 20; i++) {
        tracker.recordStep(grid)
      }

      const score = tracker.calculateInterestScore()

      // Static patterns should have lower score than active ones
      // (This is a relative test - static should have reduced score)
      expect(score).toBeLessThan(0.5) // Arbitrary threshold for static penalty
    })

    it('should return 0 if insufficient history (< 10 steps)', () => {
      const tracker = new StatisticsTracker(50, 50)
      const grid = new Uint8Array(2500)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Record only 5 steps
      for (let i = 0; i < 5; i++) {
        tracker.recordStep(grid)
      }

      const score = tracker.calculateInterestScore()
      expect(score).toBe(0)
    })
  })

  describe('getRecentStats', () => {
    it('should return requested number of stats', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      for (let i = 0; i < 30; i++) {
        tracker.recordStep(grid)
      }

      const recent = tracker.getRecentStats(10)
      expect(recent.length).toBe(10)
    })

    it('should return all stats if requested more than available', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      for (let i = 0; i < 5; i++) {
        tracker.recordStep(grid)
      }

      const recent = tracker.getRecentStats(100)
      expect(recent.length).toBe(5)
    })

    it('should return empty array if no stats recorded', () => {
      const tracker = new StatisticsTracker(10, 10)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      const recent = tracker.getRecentStats(10)
      expect(recent.length).toBe(0)
    })
  })

  describe('getActualStepsPerSecond', () => {
    it('should return 0 with insufficient data', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      tracker.recordStep(grid) // Only 1 step

      const sps = tracker.getActualStepsPerSecond()
      expect(sps).toBe(0)
    })

    it('should return non-negative SPS value', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      for (let i = 0; i < 5; i++) {
        tracker.recordStep(grid)
      }

      const sps = tracker.getActualStepsPerSecond()
      // SPS can be 0 in tests (steps happen too fast), but should not be negative
      expect(sps).toBeGreaterThanOrEqual(0)
    })
  })

  describe('getElapsedTime', () => {
    it('should return 0 if not initialized', () => {
      const tracker = new StatisticsTracker(10, 10)
      expect(tracker.getElapsedTime()).toBe(0)
    })

    it('should return elapsed milliseconds since start', () => {
      const tracker = new StatisticsTracker(10, 10)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Wait a tiny bit (not reliable in tests, but shows the API works)
      const elapsed = tracker.getElapsedTime()
      expect(elapsed).toBeGreaterThanOrEqual(0)
    })
  })

  describe('reset', () => {
    it('should clear all history', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      for (let i = 0; i < 10; i++) {
        tracker.recordStep(grid)
      }

      expect(tracker.getRecentStats(20).length).toBe(10)

      tracker.reset()

      expect(tracker.getRecentStats(20).length).toBe(0)
    })

    it('should clear metadata', () => {
      const tracker = new StatisticsTracker(10, 10)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      expect(tracker.getMetadata()).toBeDefined()

      tracker.reset()

      expect(tracker.getMetadata()).toBeNull()
    })

    it('should reset entity tracker', () => {
      const tracker = new StatisticsTracker(10, 10)
      const grid = new Uint8Array(100)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'random',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      // Record some entity-containing grids
      grid[0] = 1
      grid[1] = 1
      tracker.recordStep(grid)

      tracker.reset()

      // After reset, entity counts should restart
      tracker.initializeSimulation({
        name: 'Test2',
        seedType: 'random',
        rulesetName: 'Rule2',
        rulesetHex: 'def',
        startTime: Date.now(),
      })

      tracker.recordStep(grid)
      const stats = tracker.getRecentStats(1)[0]

      // Entity tracking should have restarted
      expect(stats).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('should handle zero-sized grid gracefully', () => {
      const tracker = new StatisticsTracker(0, 0)
      const grid = new Uint8Array(0)

      tracker.initializeSimulation({
        name: 'Test',
        seedType: 'center',
        rulesetName: 'Rule',
        rulesetHex: 'abc',
        startTime: Date.now(),
      })

      tracker.recordInitialState(grid)
      const stats = tracker.getRecentStats(1)[0]

      expect(stats.population).toBe(0)
      expect(stats.activity).toBe(0)
    })

    it('should handle very large grids', () => {
      const size = 1000
      const tracker = new StatisticsTracker(size, size)
      const grid = new Uint8Array(size * size)

      tracker.recordInitialState(grid)
      const stats = tracker.getRecentStats(1)[0]

      expect(stats).toBeDefined()
      expect(stats.population).toBe(0)
    })

    it('should handle non-square grids', () => {
      const tracker = new StatisticsTracker(20, 100)
      const grid = new Uint8Array(2000)

      for (let i = 0; i < 1000; i++) grid[i] = 1

      tracker.recordInitialState(grid)
      const stats = tracker.getRecentStats(1)[0]

      expect(stats.population).toBe(1000)
    })
  })
})
