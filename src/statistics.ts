export interface GridStatistics {
  population: number
  activity: number // cells that changed
  populationChange: number
  entropy2x2: number
  entropy4x4: number
  entropy8x8: number
}

export interface SimulationMetadata {
  name: string
  seedType: 'center' | 'random' | 'patch'
  seedPercentage?: number
  rulesetName: string
  rulesetHex: string
  startTime: number
  stepCount: number
  requestedStepsPerSecond?: number
  lastStepTime: number
}

export class StatisticsTracker {
  private history: GridStatistics[] = []
  private maxHistory = 100
  private previousGrid: Uint8Array | null = null
  private gridSize: number
  private metadata: SimulationMetadata | null = null
  private stepTimes: number[] = [] // Track last 20 step times for SPS calculation
  private maxStepTimes = 20

  constructor(gridSize: number) {
    this.gridSize = gridSize
  }

  initializeSimulation(
    metadata: Omit<SimulationMetadata, 'stepCount' | 'lastStepTime'>,
  ) {
    this.metadata = {
      ...metadata,
      stepCount: 0,
      lastStepTime: Date.now(),
    }
    this.stepTimes = []
    this.history = []
    this.previousGrid = null
  }

  getMetadata(): SimulationMetadata | null {
    return this.metadata
  }

  getElapsedTime(): number {
    if (!this.metadata) return 0
    return Date.now() - this.metadata.startTime
  }

  getActualStepsPerSecond(): number {
    if (this.stepTimes.length < 2) return 0

    const intervals = []
    for (let i = 1; i < this.stepTimes.length; i++) {
      intervals.push(this.stepTimes[i] - this.stepTimes[i - 1])
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length
    return avgInterval > 0 ? 1000 / avgInterval : 0
  }

  recordStep(grid: Uint8Array) {
    const now = Date.now()
    const stats = this.calculateStatistics(grid)
    this.history.push(stats)

    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    this.previousGrid = new Uint8Array(grid)

    // Update metadata
    if (this.metadata) {
      this.metadata.stepCount++
      this.metadata.lastStepTime = now
    }

    // Track step timing
    this.stepTimes.push(now)
    if (this.stepTimes.length > this.maxStepTimes) {
      this.stepTimes.shift()
    }
  }

  recordInitialState(grid: Uint8Array) {
    // Record the initial state without incrementing step count
    const stats = this.calculateStatistics(grid)
    this.history.push(stats)
    this.previousGrid = new Uint8Array(grid)
  }

  private calculateStatistics(grid: Uint8Array): GridStatistics {
    const population = this.calculatePopulation(grid)
    const activity = this.calculateActivity(grid)
    const populationChange = this.previousGrid
      ? population - this.calculatePopulation(this.previousGrid)
      : 0

    return {
      population,
      activity,
      populationChange,
      entropy2x2: this.calculateBlockEntropy(grid, 2),
      entropy4x4: this.calculateBlockEntropy(grid, 4),
      entropy8x8: this.calculateBlockEntropy(grid, 8),
    }
  }

  private calculatePopulation(grid: Uint8Array): number {
    let count = 0
    for (let i = 0; i < grid.length; i++) {
      if (grid[i]) count++
    }
    return count
  }

  private calculateActivity(grid: Uint8Array): number {
    if (!this.previousGrid) return 0

    let changes = 0
    for (let i = 0; i < grid.length; i++) {
      if (grid[i] !== this.previousGrid[i]) changes++
    }
    return changes
  }

  private calculateBlockEntropy(grid: Uint8Array, blockSize: number): number {
    // Calculate Shannon entropy of block patterns
    const blockCounts = new Map<number, number>()
    const stride = Math.floor(blockSize / 2) // Overlapping blocks for better sampling

    for (let y = 0; y <= this.gridSize - blockSize; y += stride) {
      for (let x = 0; x <= this.gridSize - blockSize; x += stride) {
        const pattern = this.getBlockPattern(grid, x, y, blockSize)
        blockCounts.set(pattern, (blockCounts.get(pattern) || 0) + 1)
      }
    }

    // Calculate Shannon entropy
    const totalBlocks = Array.from(blockCounts.values()).reduce(
      (a, b) => a + b,
      0,
    )
    let entropy = 0

    for (const count of blockCounts.values()) {
      const p = count / totalBlocks
      if (p > 0) {
        entropy -= p * Math.log2(p)
      }
    }

    return entropy
  }

  private getBlockPattern(
    grid: Uint8Array,
    startX: number,
    startY: number,
    blockSize: number,
  ): number {
    let pattern = 0
    let bit = 0

    for (let dy = 0; dy < blockSize; dy++) {
      for (let dx = 0; dx < blockSize; dx++) {
        const x = startX + dx
        const y = startY + dy
        if (grid[y * this.gridSize + x]) {
          pattern |= 1 << bit
        }
        bit++
      }
    }

    return pattern
  }

  calculateInterestScore(): number {
    if (this.history.length < 10) return 0

    const recent = this.history.slice(-20)
    const totalCells = this.gridSize * this.gridSize

    // Get average values
    const avgPopulation =
      recent.reduce((sum, s) => sum + s.population, 0) / recent.length
    const avgActivity =
      recent.reduce((sum, s) => sum + s.activity, 0) / recent.length
    const avgEntropy2x2 =
      recent.reduce((sum, s) => sum + s.entropy2x2, 0) / recent.length
    const avgEntropy4x4 =
      recent.reduce((sum, s) => sum + s.entropy4x4, 0) / recent.length
    const avgEntropy8x8 =
      recent.reduce((sum, s) => sum + s.entropy8x8, 0) / recent.length

    const populationRatio = avgPopulation / totalCells
    const activityRatio = avgActivity / totalCells

    // 1. Penalize die-out (population too low)
    let dieOutPenalty = 1
    if (populationRatio < 0.01) {
      dieOutPenalty = 0 // Complete die-out is uninteresting
    } else if (populationRatio < 0.05) {
      dieOutPenalty = populationRatio / 0.05 // Gradual penalty
    }

    // 2. Penalize uniform expansion (population too high)
    let expansionPenalty = 1
    if (populationRatio > 0.95) {
      expansionPenalty = 0 // Complete fill is uninteresting
    } else if (populationRatio > 0.8) {
      expansionPenalty = (1 - populationRatio) / 0.2 // Gradual penalty
    }

    // 3. Reward high entropy at multiple scales
    // Theoretical maxima for Shannon entropy of blocks
    const maxEntropy2x2 = 4 // log2(2^4)
    const maxEntropy4x4 = 16 // log2(2^16)
    const maxEntropy8x8 = 20 // Practical cap (full 64 bits is unrealistic)

    const entropy2x2Score = avgEntropy2x2 / maxEntropy2x2
    const entropy4x4Score = avgEntropy4x4 / maxEntropy4x4
    const entropy8x8Score =
      Math.min(avgEntropy8x8, maxEntropy8x8) / maxEntropy8x8

    // Weighted combination favoring mid-scale entropy (4x4)
    const entropyScore =
      entropy2x2Score * 0.25 + entropy4x4Score * 0.5 + entropy8x8Score * 0.25

    // Activity score - reward ongoing changes (not static)
    const activityScore = Math.min(activityRatio * 50, 1) // Scale up activity impact

    // Reward patterns in the "Goldilocks zone" of population
    const goldilocksPop =
      populationRatio > 0.1 && populationRatio < 0.7 ? 1 : 0.5

    // Final interest score
    const interestScore =
      (entropyScore * 0.5 + // High entropy is key
        activityScore * 0.3 + // Activity matters
        goldilocksPop * 0.2) * // Population in good range
      dieOutPenalty *
      expansionPenalty

    return Math.max(0, Math.min(1, interestScore))
  }

  getRecentStats(count = 20): GridStatistics[] {
    return this.history.slice(-count)
  }

  reset() {
    this.history = []
    this.previousGrid = null
    this.metadata = null
    this.stepTimes = []
  }
}
