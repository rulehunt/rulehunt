/**
 * Benchmark Runner Component
 *
 * Responsible for executing benchmarks, accumulating results, and managing persistence.
 * Extracted from benchmark.ts to improve maintainability and testability.
 */

import type { BenchmarkConfig, BenchmarkResult } from './benchmark'
import { runBenchmarkSuite } from './benchmark'
import type { AccumulatedBenchmarkResult } from './benchmarkChart'

export interface BenchmarkProgress {
  current: number
  total: number
  status: string
  roundNumber: number
}

export type BenchmarkProgressCallback = (progress: BenchmarkProgress) => void
export type BenchmarkCompleteCallback = (
  results: BenchmarkResult[],
  roundNumber: number,
) => void

// localStorage key for persistent results
const STORAGE_KEY = 'rulehunt-benchmark-results'

/**
 * Load accumulated results from localStorage
 */
export function loadFromStorage(): {
  results: Map<string, AccumulatedBenchmarkResult>
  roundCount: number
} {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const data = JSON.parse(stored)
      const resultsMap = new Map<string, AccumulatedBenchmarkResult>()
      for (const [key, value] of Object.entries(data.results)) {
        resultsMap.set(key, value as AccumulatedBenchmarkResult)
      }
      return {
        results: resultsMap,
        roundCount: data.roundCount || 0,
      }
    }
  } catch (error) {
    console.error('Failed to load benchmark results from localStorage:', error)
  }
  return { results: new Map(), roundCount: 0 }
}

/**
 * Save accumulated results to localStorage
 */
export function saveToStorage(
  results: Map<string, AccumulatedBenchmarkResult>,
  roundCount: number,
): void {
  try {
    const data = {
      results: Object.fromEntries(results),
      roundCount,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch (error) {
    console.error('Failed to save benchmark results to localStorage:', error)
  }
}

/**
 * Clear stored results from localStorage
 */
export function clearStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch (error) {
    console.error('Failed to clear benchmark results from localStorage:', error)
  }
}

/**
 * Accumulate new benchmark results with existing results
 */
export function accumulateResults(
  accumulatedResults: Map<string, AccumulatedBenchmarkResult>,
  newResults: BenchmarkResult[],
): void {
  for (const result of newResults) {
    const existing = accumulatedResults.get(result.gridSize)
    if (existing) {
      // Add new SPS samples to existing arrays
      existing.cpuSamples.push(result.cpuSPS)
      existing.gpuSamples.push(result.gpuSPS)
      existing.sampleCount = existing.cpuSamples.length

      // Recalculate averages
      const cpuAvg =
        existing.cpuSamples.reduce((a, b) => a + b, 0) /
        existing.cpuSamples.length
      const gpuAvg =
        existing.gpuSamples.reduce((a, b) => a + b, 0) /
        existing.gpuSamples.length
      existing.cpuSPS = cpuAvg
      existing.gpuSPS = gpuAvg
      existing.winner = cpuAvg > gpuAvg ? 'cpu' : 'gpu' // Higher SPS is better
      existing.speedup =
        existing.winner === 'gpu' ? gpuAvg / cpuAvg : cpuAvg / gpuAvg
    } else {
      // First time seeing this grid size
      accumulatedResults.set(result.gridSize, {
        ...result,
        cpuSamples: [result.cpuSPS],
        gpuSamples: [result.gpuSPS],
        sampleCount: 1,
      })
    }
  }
}

/**
 * Continuous benchmark runner that runs until stopped
 */
export class BenchmarkRunner {
  private shouldStop = false
  private accumulatedResults: Map<string, AccumulatedBenchmarkResult>
  private roundCount: number

  constructor() {
    const { results, roundCount } = loadFromStorage()
    this.accumulatedResults = results
    this.roundCount = roundCount
  }

  /**
   * Get accumulated results
   */
  getAccumulatedResults(): Map<string, AccumulatedBenchmarkResult> {
    return this.accumulatedResults
  }

  /**
   * Get current round count
   */
  getRoundCount(): number {
    return this.roundCount
  }

  /**
   * Clear all accumulated results
   */
  clearResults(): void {
    this.accumulatedResults.clear()
    this.roundCount = 0
    clearStorage()
  }

  /**
   * Stop the benchmark runner
   */
  stop(): void {
    this.shouldStop = true
  }

  /**
   * Run benchmark suite continuously until stopped
   */
  async run(
    orbitLookup: Uint8Array,
    config: BenchmarkConfig,
    onProgress: BenchmarkProgressCallback,
    onComplete: BenchmarkCompleteCallback,
  ): Promise<void> {
    this.shouldStop = false

    try {
      do {
        this.roundCount++
        onProgress({
          current: 0,
          total: config.gridSizes.length * 2,
          status: `Starting round ${this.roundCount}...`,
          roundNumber: this.roundCount,
        })

        const roundResults = await runBenchmarkSuite(
          orbitLookup,
          config,
          (current, total, testName) => {
            onProgress({
              current,
              total,
              status: `Round ${this.roundCount}: ${testName} (${current}/${total})`,
              roundNumber: this.roundCount,
            })
          },
        )

        // Accumulate results
        accumulateResults(this.accumulatedResults, roundResults)

        // Save to localStorage after each round
        saveToStorage(this.accumulatedResults, this.roundCount)

        // Notify completion with accumulated results
        const displayResults = Array.from(
          this.accumulatedResults.values(),
        ).sort((a, b) => a.cells - b.cells)
        onComplete(displayResults, this.roundCount)

        // Small delay before next round
        if (!this.shouldStop) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      } while (!this.shouldStop)
    } catch (error) {
      throw new Error(
        `Benchmark failed: ${error instanceof Error ? error.message : 'Unknown error occurred'}`,
      )
    }
  }
}
