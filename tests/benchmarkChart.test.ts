/**
 * Tests for benchmarkChart.ts
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateStdDev,
  createBenchmarkChart,
  resetChart,
  updateChart,
} from '../src/components/desktop/benchmarkChart'
import type { BenchmarkResult } from '../src/components/desktop/benchmark'

describe('benchmarkChart', () => {
  let canvas: HTMLCanvasElement

  beforeEach(() => {
    // Create a canvas element for testing
    canvas = document.createElement('canvas')
    document.body.appendChild(canvas)
  })

  describe('calculateStdDev', () => {
    it('should return 0 for single value', () => {
      expect(calculateStdDev([5])).toBe(0)
    })

    it('should return 0 for empty array', () => {
      expect(calculateStdDev([])).toBe(0)
    })

    it('should calculate standard deviation correctly', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9]
      const result = calculateStdDev(values)
      // Expected std dev is approximately 2.0
      expect(result).toBeCloseTo(2.0, 1)
    })

    it('should handle identical values', () => {
      const values = [5, 5, 5, 5]
      expect(calculateStdDev(values)).toBe(0)
    })
  })

  describe('createBenchmarkChart', () => {
    it('should create a chart instance', () => {
      const chart = createBenchmarkChart(canvas)
      expect(chart).toBeDefined()
      expect(chart).not.toBeNull()
    })

    it('should return null if canvas has no 2D context', () => {
      // Mock getContext to return null
      const mockCanvas = {
        getContext: vi.fn(() => null),
      } as unknown as HTMLCanvasElement

      const chart = createBenchmarkChart(mockCanvas)
      expect(chart).toBeNull()
    })

    it('should have correct chart type', () => {
      const chart = createBenchmarkChart(canvas)
      expect(chart?.config.type).toBe('lineWithErrorBars')
    })

    it('should have two datasets (CPU and GPU)', () => {
      const chart = createBenchmarkChart(canvas)
      expect(chart?.data.datasets).toHaveLength(2)
      expect(chart?.data.datasets[0].label).toBe('CPU (SPS)')
      expect(chart?.data.datasets[1].label).toBe('GPU (SPS)')
    })

    it('should initialize with empty data', () => {
      const chart = createBenchmarkChart(canvas)
      expect(chart?.data.labels).toHaveLength(0)
      expect(chart?.data.datasets[0].data).toHaveLength(0)
      expect(chart?.data.datasets[1].data).toHaveLength(0)
    })
  })

  describe('updateChart', () => {
    it('should update chart with benchmark results', () => {
      const chart = createBenchmarkChart(canvas)
      if (!chart) throw new Error('Chart creation failed')

      const results: BenchmarkResult[] = [
        {
          gridSize: '100x100',
          cells: 10_000,
          cpuSPS: 100,
          gpuSPS: 50,
          winner: 'cpu',
          speedup: 2,
        },
        {
          gridSize: '200x200',
          cells: 40_000,
          cpuSPS: 80,
          gpuSPS: 120,
          winner: 'gpu',
          speedup: 1.5,
        },
      ]

      const accumulatedResults = new Map([
        [
          '100x100',
          {
            ...results[0],
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        ],
        [
          '200x200',
          {
            ...results[1],
            cpuSamples: [80],
            gpuSamples: [120],
            sampleCount: 1,
          },
        ],
      ])

      updateChart(chart, results, accumulatedResults)

      expect(chart.data.labels).toHaveLength(2)
      expect(chart.data.datasets[0].data).toHaveLength(2)
      expect(chart.data.datasets[1].data).toHaveLength(2)
    })

    it('should sort results by cell count', () => {
      const chart = createBenchmarkChart(canvas)
      if (!chart) throw new Error('Chart creation failed')

      const results: BenchmarkResult[] = [
        {
          gridSize: '200x200',
          cells: 40_000,
          cpuSPS: 80,
          gpuSPS: 120,
          winner: 'gpu',
          speedup: 1.5,
        },
        {
          gridSize: '100x100',
          cells: 10_000,
          cpuSPS: 100,
          gpuSPS: 50,
          winner: 'cpu',
          speedup: 2,
        },
      ]

      const accumulatedResults = new Map([
        [
          '100x100',
          {
            ...results[1],
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        ],
        [
          '200x200',
          {
            ...results[0],
            cpuSamples: [80],
            gpuSamples: [120],
            sampleCount: 1,
          },
        ],
      ])

      updateChart(chart, results, accumulatedResults)

      // Should be sorted by cells: 10_000, then 40_000
      expect(chart.data.labels?.[0]).toBe(10_000)
      expect(chart.data.labels?.[1]).toBe(40_000)
    })
  })

  describe('resetChart', () => {
    it('should clear all chart data', () => {
      const chart = createBenchmarkChart(canvas)
      if (!chart) throw new Error('Chart creation failed')

      // First add some data
      const results: BenchmarkResult[] = [
        {
          gridSize: '100x100',
          cells: 10_000,
          cpuSPS: 100,
          gpuSPS: 50,
          winner: 'cpu',
          speedup: 2,
        },
      ]

      const accumulatedResults = new Map([
        [
          '100x100',
          {
            ...results[0],
            cpuSamples: [100],
            gpuSamples: [50],
            sampleCount: 1,
          },
        ],
      ])

      updateChart(chart, results, accumulatedResults)

      // Now reset
      resetChart(chart)

      expect(chart.data.labels).toHaveLength(0)
      expect(chart.data.datasets[0].data).toHaveLength(0)
      expect(chart.data.datasets[1].data).toHaveLength(0)
    })
  })
})
