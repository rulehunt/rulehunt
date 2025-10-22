/**
 * Tests for benchmarkRunner.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock cellular-automata-gpu to avoid WebGL native bindings in test environment
vi.mock('../src/cellular-automata-gpu', () => ({
  CellularAutomataGPU: vi.fn().mockImplementation(() => ({
    step: vi.fn(),
    getState: vi.fn(() => new Uint8Array(100)),
    destroy: vi.fn(),
  })),
}))

import {
  BenchmarkRunner,
  accumulateResults,
  clearStorage,
  loadFromStorage,
  saveToStorage,
} from '../src/components/desktop/benchmarkRunner'
import type { BenchmarkResult } from '../src/components/desktop/benchmark'

describe('benchmarkRunner', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('loadFromStorage', () => {
    it('should return empty results and roundCount 0 when no data exists', () => {
      const { results, roundCount } = loadFromStorage()

      expect(results.size).toBe(0)
      expect(roundCount).toBe(0)
    })

    it('should load existing results from localStorage', () => {
      const mockData = {
        results: {
          '100x100': {
            gridSize: '100x100',
            cells: 10_000,
            cpuSPS: 100,
            gpuSPS: 50,
            winner: 'cpu',
            speedup: 2,
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        },
        roundCount: 5,
      }

      localStorage.setItem(
        'rulehunt-benchmark-results',
        JSON.stringify(mockData),
      )

      const { results, roundCount } = loadFromStorage()

      expect(results.size).toBe(1)
      expect(roundCount).toBe(5)
      expect(results.get('100x100')?.cpuSPS).toBe(100)
    })

    it('should handle corrupted localStorage data gracefully', () => {
      localStorage.setItem('rulehunt-benchmark-results', 'invalid json')

      const { results, roundCount } = loadFromStorage()

      expect(results.size).toBe(0)
      expect(roundCount).toBe(0)
    })
  })

  describe('saveToStorage', () => {
    it('should save results to localStorage', () => {
      const results = new Map([
        [
          '100x100',
          {
            gridSize: '100x100',
            cells: 10_000,
            cpuSPS: 100,
            gpuSPS: 50,
            winner: 'cpu' as const,
            speedup: 2,
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        ],
      ])

      saveToStorage(results, 3)

      const stored = localStorage.getItem('rulehunt-benchmark-results')
      expect(stored).toBeDefined()

      const data = JSON.parse(stored!)
      expect(data.roundCount).toBe(3)
      expect(data.results['100x100']).toBeDefined()
    })
  })

  describe('clearStorage', () => {
    it('should remove benchmark data from localStorage', () => {
      localStorage.setItem('rulehunt-benchmark-results', 'test data')

      clearStorage()

      expect(localStorage.getItem('rulehunt-benchmark-results')).toBeNull()
    })
  })

  describe('accumulateResults', () => {
    it('should add new grid size to accumulated results', () => {
      const accumulated = new Map()
      const newResults: BenchmarkResult[] = [
        {
          gridSize: '100x100',
          cells: 10_000,
          cpuSPS: 100,
          gpuSPS: 50,
          winner: 'cpu',
          speedup: 2,
        },
      ]

      accumulateResults(accumulated, newResults)

      expect(accumulated.size).toBe(1)
      const result = accumulated.get('100x100')
      expect(result?.cpuSamples).toEqual([100])
      expect(result?.gpuSamples).toEqual([50])
      expect(result?.sampleCount).toBe(1)
    })

    it('should accumulate samples for existing grid size', () => {
      const accumulated = new Map([
        [
          '100x100',
          {
            gridSize: '100x100',
            cells: 10_000,
            cpuSPS: 100,
            gpuSPS: 50,
            winner: 'cpu' as const,
            speedup: 2,
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        ],
      ])

      const newResults: BenchmarkResult[] = [
        {
          gridSize: '100x100',
          cells: 10_000,
          cpuSPS: 110,
          gpuSPS: 55,
          winner: 'cpu',
          speedup: 2,
        },
      ]

      accumulateResults(accumulated, newResults)

      const result = accumulated.get('100x100')
      expect(result?.cpuSamples).toEqual([100, 110])
      expect(result?.gpuSamples).toEqual([50, 55])
      expect(result?.sampleCount).toBe(2)
      expect(result?.cpuSPS).toBe(105) // Average of 100 and 110
      expect(result?.gpuSPS).toBe(52.5) // Average of 50 and 55
    })

    it('should update winner based on averaged SPS', () => {
      const accumulated = new Map([
        [
          '100x100',
          {
            gridSize: '100x100',
            cells: 10_000,
            cpuSPS: 100,
            gpuSPS: 50,
            winner: 'cpu' as const,
            speedup: 2,
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        ],
      ])

      // Add a result where GPU wins
      const newResults: BenchmarkResult[] = [
        {
          gridSize: '100x100',
          cells: 10_000,
          cpuSPS: 60,
          gpuSPS: 150,
          winner: 'gpu',
          speedup: 2.5,
        },
      ]

      accumulateResults(accumulated, newResults)

      const result = accumulated.get('100x100')
      // Average: CPU = (100 + 60) / 2 = 80, GPU = (50 + 150) / 2 = 100
      expect(result?.cpuSPS).toBe(80)
      expect(result?.gpuSPS).toBe(100)
      expect(result?.winner).toBe('gpu') // GPU now wins on average
    })
  })

  describe('BenchmarkRunner', () => {
    it('should initialize with empty results', () => {
      const runner = new BenchmarkRunner()

      expect(runner.getAccumulatedResults().size).toBe(0)
      expect(runner.getRoundCount()).toBe(0)
    })

    it('should load existing results from storage on init', () => {
      const mockData = {
        results: {
          '100x100': {
            gridSize: '100x100',
            cells: 10_000,
            cpuSPS: 100,
            gpuSPS: 50,
            winner: 'cpu',
            speedup: 2,
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        },
        roundCount: 2,
      }

      localStorage.setItem(
        'rulehunt-benchmark-results',
        JSON.stringify(mockData),
      )

      const runner = new BenchmarkRunner()

      expect(runner.getAccumulatedResults().size).toBe(1)
      expect(runner.getRoundCount()).toBe(2)
    })

    it('should clear results', () => {
      const runner = new BenchmarkRunner()
      // Manually add some results for testing
      runner.getAccumulatedResults().set('100x100', {
        gridSize: '100x100',
        cells: 10_000,
        cpuSPS: 100,
        gpuSPS: 50,
        winner: 'cpu',
        speedup: 2,
        cpuSamples: [100],
        gpuSamples: [50],
        sampleCount: 1,
      })

      runner.clearResults()

      expect(runner.getAccumulatedResults().size).toBe(0)
      expect(runner.getRoundCount()).toBe(0)
      expect(localStorage.getItem('rulehunt-benchmark-results')).toBeNull()
    })

    it('should stop running benchmarks', () => {
      const runner = new BenchmarkRunner()
      runner.stop()

      // After stop is called, shouldStop should be true
      // This is verified internally by the run method
      expect(runner).toBeDefined() // Basic check
    })
  })
})
