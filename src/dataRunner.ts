// src/dataRunner.ts

import { formatRulesetName, saveRun } from './api/save'
import { CellularAutomata } from './cellular-automata-cpu'
import {
  incrementSaveErrorCount,
  loadDataStats,
  updateAccumulatedStats,
} from './dataStorage'
import { outlierRule } from './outlier-rule'
import type { C4Ruleset, RunSubmission } from './schema'
import {
  c4RulesetToHex,
  conwayRule,
  expandC4Ruleset,
  makeC4Ruleset,
  randomC4RulesetByDensity,
} from './utils'

const PROGRESS_BAR_STEPS = 500
const GRID_ROWS = 400
const GRID_COLS = 400
const DELAY_BETWEEN_RUNS_MS = 100
const SAVE_RETRY_ATTEMPTS = 3

export interface DataModeState {
  roundCount: number
  rulesetName: string
  rulesetHex: string
  currentStep: number
  totalSteps: number
  interestScore?: number
}

export type DataProgressCallback = (state: DataModeState) => void

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function generateNextRuleset(
  roundNumber: number,
  orbitLookup: Uint8Array,
): { ruleset: C4Ruleset; name: string; hex: string } {
  // 10% preset rulesets (Conway, Outlier)
  if (roundNumber % 10 === 0) {
    const ruleset = makeC4Ruleset(conwayRule, orbitLookup)
    return {
      ruleset,
      name: formatRulesetName('conway'),
      hex: c4RulesetToHex(ruleset),
    }
  }

  if (roundNumber % 10 === 5) {
    const ruleset = makeC4Ruleset(outlierRule, orbitLookup)
    return {
      ruleset,
      name: formatRulesetName('outlier'),
      hex: c4RulesetToHex(ruleset),
    }
  }

  // 90% random by density - cycle through 10% to 90%
  const baseDensity = ((roundNumber % 9) + 1) * 10 // 10, 20, 30...90
  const jitter = (Math.random() - 0.5) * 10 // ±5%
  const density = Math.max(5, Math.min(95, baseDensity + jitter)) / 100

  const ruleset = randomC4RulesetByDensity(density)
  const hex = c4RulesetToHex(ruleset)

  return {
    ruleset,
    name: formatRulesetName('random', density * 100),
    hex,
  }
}

async function saveRunWithRetry(
  payload: Omit<RunSubmission, 'userId' | 'userLabel'>,
  maxRetries = SAVE_RETRY_ATTEMPTS,
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await saveRun(payload)
      console.log(`[DataMode] Run saved successfully (attempt ${attempt})`)
      return true
    } catch (error) {
      console.error(`[DataMode] Save failed (attempt ${attempt}):`, error)

      if (attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delayMs = 2 ** (attempt - 1) * 1000
        await delay(delayMs)
      } else {
        // Final failure - log and update error counter
        console.error('[DataMode] All retry attempts failed')
        incrementSaveErrorCount()
        return false
      }
    }
  }
  return false
}

export async function runDataLoop(
  orbitLookup: Uint8Array,
  onProgress: DataProgressCallback,
  pauseCheck: () => boolean,
  getStepsPerSecond: () => number,
): Promise<() => void> {
  let shouldStop = false
  const stats = loadDataStats()
  let roundCount = stats.roundCount

  // Start the loop
  ;(async () => {
    while (!shouldStop) {
      // Check if paused
      while (pauseCheck() && !shouldStop) {
        await delay(100)
      }

      if (shouldStop) break

      roundCount++

      // 1. Generate ruleset
      const { ruleset, name, hex } = generateNextRuleset(
        roundCount,
        orbitLookup,
      )

      console.log(`[DataMode] Starting round ${roundCount}: ${name}`)

      // 2. Create CPU cellular automata (no canvas for data mode)
      const ca = new CellularAutomata(null, {
        gridRows: GRID_ROWS,
        gridCols: GRID_COLS,
        fgColor: '#000000',
        bgColor: '#ffffff',
      })

      // 3. Apply initial conditions (overrides constructor's randomSeed())
      ca.clearGrid()
      ca.patchSeed()

      // 4. Expand ruleset once
      const expandedRuleset = expandC4Ruleset(ruleset, orbitLookup)

      // 5. Run simulation with progress updates and throttling
      const startTime = performance.now()
      let lastProgressUpdate = startTime
      let lastThrottleTime = startTime

      for (let step = 0; step < PROGRESS_BAR_STEPS; step++) {
        if (shouldStop) break

        ca.step(expandedRuleset)

        const now = performance.now()
        const sps = getStepsPerSecond()

        // Update UI every 100ms
        if (
          now - lastProgressUpdate >= 100 ||
          step === PROGRESS_BAR_STEPS - 1
        ) {
          const currentStats = ca.getStatistics()
          const interestScore = currentStats.calculateInterestScore()

          onProgress({
            roundCount,
            rulesetName: name,
            rulesetHex: hex,
            currentStep: step + 1,
            totalSteps: PROGRESS_BAR_STEPS,
            interestScore,
          })

          lastProgressUpdate = now
        }

        // Throttle if needed (sps === 0 means unlimited)
        if (sps > 0) {
          const targetDelayMs = 1000 / sps
          const elapsedSinceLastThrottle = now - lastThrottleTime

          if (elapsedSinceLastThrottle < targetDelayMs) {
            await delay(targetDelayMs - elapsedSinceLastThrottle)
            lastThrottleTime = performance.now()
          } else {
            lastThrottleTime = now
            // Yield to browser even if not throttling
            if (step % 10 === 0) {
              await delay(0)
            }
          }
        } else {
          // Unlimited mode - still yield occasionally for UI updates
          if (step % 10 === 0) {
            await delay(0)
          }
        }
      }

      if (shouldStop) break

      const endTime = performance.now()
      const computeTimeMs = endTime - startTime

      // 6. Collect statistics
      const caStats = ca.getStatistics()
      const recentStats = caStats.getRecentStats(1)[0]
      const interestScore = caStats.calculateInterestScore()

      // 7. Build submission payload
      const runPayload: Omit<RunSubmission, 'userId' | 'userLabel'> = {
        rulesetName: name,
        rulesetHex: hex,
        seed: ca.getSeed(),
        seedType: 'patch',
        seedPercentage: undefined, // patchSeed() uses random percentage
        stepCount: PROGRESS_BAR_STEPS,
        watchedSteps: PROGRESS_BAR_STEPS,
        watchedWallMs: Math.round(computeTimeMs),
        gridSize: ca.getGridSize(),
        progress_bar_steps: PROGRESS_BAR_STEPS,
        requestedSps: undefined,
        actualSps: PROGRESS_BAR_STEPS / (computeTimeMs / 1000),
        population: recentStats.population,
        activity: recentStats.activity,
        populationChange: recentStats.populationChange,
        entropy2x2: recentStats.entropy2x2,
        entropy4x4: recentStats.entropy4x4,
        entropy8x8: recentStats.entropy8x8,
        entityCount: recentStats.entityCount,
        entityChange: recentStats.entityChange,
        totalEntitiesEverSeen: recentStats.totalEntitiesEverSeen,
        uniquePatterns: recentStats.uniquePatterns,
        entitiesAlive: recentStats.entitiesAlive,
        entitiesDied: recentStats.entitiesDied,
        interestScore,
        simVersion: 'v0.1.0-datamode',
        engineCommit: undefined,
        extraScores: undefined,
      }

      // 8. Save to API (with retry)
      const saveSuccess = await saveRunWithRetry(runPayload)

      // 9. Update accumulated stats in localStorage
      updateAccumulatedStats({
        roundCount,
        computeTimeMs,
        stepCount: PROGRESS_BAR_STEPS,
        rulesetHex: hex,
        interestScore,
        rulesetName: name,
        success: saveSuccess,
      })

      console.log(
        `[DataMode] Round ${roundCount} complete: ${name} (score: ${interestScore.toFixed(1)}, ${computeTimeMs.toFixed(0)}ms)`,
      )

      // 10. Small delay to prevent browser freezing
      await delay(DELAY_BETWEEN_RUNS_MS)
    }

    console.log('[DataMode] Loop stopped')
  })()

  // Return stop function
  return () => {
    shouldStop = true
  }
}
