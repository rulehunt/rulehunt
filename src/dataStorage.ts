// src/dataStorage.ts

export interface DataStats {
  roundCount: number
  totalSteps: number
  totalComputeTimeMs: number
  uniqueRulesets: string[] // Array of hex strings
  runsSaved: number
  saveErrors: number
  highScores: Array<{
    rulesetName: string
    rulesetHex: string
    interestScore: number
    timestamp: number
  }>
  startTime: number
  lastUpdateTime: number
}

const STORAGE_KEY = 'rulehunt-data-stats'

export function loadDataStats(): DataStats {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('[dataStorage] Failed to load stats:', error)
  }

  return {
    roundCount: 0,
    totalSteps: 0,
    totalComputeTimeMs: 0,
    uniqueRulesets: [],
    runsSaved: 0,
    saveErrors: 0,
    highScores: [],
    startTime: Date.now(),
    lastUpdateTime: Date.now(),
  }
}

export function saveDataStats(stats: DataStats): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  } catch (error) {
    console.error('[dataStorage] Failed to save stats:', error)
  }
}

export function updateAccumulatedStats(update: {
  roundCount: number
  computeTimeMs: number
  stepCount: number
  rulesetHex: string
  interestScore: number
  rulesetName: string
  success: boolean
}): void {
  const stats = loadDataStats()

  stats.roundCount = update.roundCount
  stats.totalSteps += update.stepCount
  stats.totalComputeTimeMs += update.computeTimeMs
  stats.lastUpdateTime = Date.now()

  // Track unique rulesets
  if (!stats.uniqueRulesets.includes(update.rulesetHex)) {
    stats.uniqueRulesets.push(update.rulesetHex)
  }

  // Update counters
  if (update.success) {
    stats.runsSaved++
  } else {
    stats.saveErrors++
  }

  // Update high scores (keep top 10)
  stats.highScores.push({
    rulesetName: update.rulesetName,
    rulesetHex: update.rulesetHex,
    interestScore: update.interestScore,
    timestamp: Date.now(),
  })
  stats.highScores.sort((a, b) => b.interestScore - a.interestScore)
  stats.highScores = stats.highScores.slice(0, 10)

  saveDataStats(stats)
}

export function incrementSaveErrorCount(): void {
  const stats = loadDataStats()
  stats.saveErrors++
  saveDataStats(stats)
}

export function clearDataStats(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}h ${minutes}m ${seconds}s`
}

// Auto-mutate preference storage
const AUTO_MUTATE_KEY = 'rulehunt-auto-mutate-enabled'

export function getAutoMutateEnabled(): boolean {
  const stored = localStorage.getItem(AUTO_MUTATE_KEY)
  return stored === null ? true : stored === 'true' // Default: enabled
}

export function setAutoMutateEnabled(enabled: boolean): void {
  localStorage.setItem(AUTO_MUTATE_KEY, String(enabled))
}
