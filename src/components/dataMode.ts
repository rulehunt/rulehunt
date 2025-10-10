// src/components/dataMode.ts

import type { DataModeState } from '../dataRunner'
import { runDataLoop } from '../dataRunner'
import {
  clearDataStats,
  formatDuration,
  formatTimeAgo,
  loadDataStats,
} from '../dataStorage'
import type { C4OrbitsData } from '../schema'
import { buildOrbitLookup } from '../utils'
import { createHeader, setupTheme } from './desktopHeader'
import { createProgressBar } from './progressBar'

export type CleanupFunction = () => void

export async function setupDataModeLayout(
  appRoot: HTMLDivElement,
): Promise<CleanupFunction> {
  console.log('[DataMode] Setting up data mode layout')

  // Create header
  const header = createHeader()
  appRoot.appendChild(header.root)

  // Create main content
  const mainContent = document.createElement('main')
  mainContent.className = 'flex-1 flex items-center justify-center p-6 lg:p-12'

  const container = document.createElement('div')
  container.className = 'max-w-4xl w-full space-y-6'

  // Title Card
  const titleCard = document.createElement('div')
  titleCard.className =
    'bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6'
  titleCard.innerHTML = `
    <div class="flex items-center justify-between flex-wrap gap-4">
      <div class="flex items-center gap-3">
        <span class="text-3xl">🤖</span>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Data Mode</h1>
      </div>
      <div class="flex gap-2">
        <button id="btn-pause" class="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors">
          Pause
        </button>
        <button id="btn-clear" class="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors">
          Clear Data
        </button>
        <button id="btn-stop" class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
          Stop & Exit
        </button>
      </div>
    </div>
  `

  // Current Run Card
  const currentRunCard = document.createElement('div')
  currentRunCard.className =
    'bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6'
  currentRunCard.innerHTML = `
    <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Current Run</h2>
    <div id="current-run-content" class="space-y-2 text-sm">
      <div class="flex justify-between">
        <span class="text-gray-600 dark:text-gray-400">Ruleset:</span>
        <span id="current-ruleset" class="text-gray-900 dark:text-white font-mono">--</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600 dark:text-gray-400">Hex:</span>
        <span id="current-hex" class="text-gray-900 dark:text-white font-mono text-xs truncate max-w-xs">--</span>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <label for="speed-slider" class="min-w-16 text-right text-gray-600 dark:text-gray-400">Speed:</label>
        <input type="range" id="speed-slider" min="10" max="1000" value="200" class="w-48 cursor-pointer" />
        <span id="speed-value" class="min-w-20 text-gray-900 dark:text-white">200/sec</span>
      </div>
      <div class="mt-4" id="progress-container"></div>
      <div class="flex justify-between">
        <span class="text-gray-600 dark:text-gray-400">Steps:</span>
        <span id="current-steps" class="text-gray-900 dark:text-white font-semibold">0 / 500</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600 dark:text-gray-400">Actual SPS:</span>
        <span id="current-sps" class="text-gray-900 dark:text-white font-semibold">--</span>
      </div>
      <div class="flex justify-between">
        <span class="text-gray-600 dark:text-gray-400">Interest Score:</span>
        <span id="current-interest" class="text-gray-900 dark:text-white font-semibold">--</span>
      </div>
    </div>
  `

  // Stats Card
  const statsCard = document.createElement('div')
  statsCard.className =
    'bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6'
  statsCard.innerHTML = `
    <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Accumulated Statistics</h2>
    <div id="stats-content" class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <div class="text-gray-600 dark:text-gray-400">Total Rounds</div>
        <div id="stat-rounds" class="text-2xl font-bold text-gray-900 dark:text-white">0</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400">Total Steps</div>
        <div id="stat-steps" class="text-2xl font-bold text-gray-900 dark:text-white">0</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400">Compute Time</div>
        <div id="stat-time" class="text-2xl font-bold text-gray-900 dark:text-white">0s</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400">Unique Rulesets</div>
        <div id="stat-rulesets" class="text-2xl font-bold text-gray-900 dark:text-white">0</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400">Runs Saved</div>
        <div id="stat-saved" class="text-2xl font-bold text-green-600 dark:text-green-500">0</div>
      </div>
      <div>
        <div class="text-gray-600 dark:text-gray-400">Save Errors</div>
        <div id="stat-errors" class="text-2xl font-bold text-red-600 dark:text-red-500">0</div>
      </div>
    </div>
  `

  // High Scores Card
  const scoresCard = document.createElement('div')
  scoresCard.className =
    'bg-white dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-600 p-6'
  scoresCard.innerHTML = `
    <h2 class="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Recent High Scores</h2>
    <div id="high-scores-content" class="space-y-2 text-sm">
      <div class="text-gray-600 dark:text-gray-400 text-center py-4">No scores yet</div>
    </div>
  `

  // Assemble layout
  container.appendChild(titleCard)
  container.appendChild(currentRunCard)
  container.appendChild(statsCard)
  container.appendChild(scoresCard)
  mainContent.appendChild(container)
  appRoot.appendChild(mainContent)

  // Initialize progress bar
  const progressBar = createProgressBar({
    initialValue: 0,
    buttonLabel: '', // No button in headless mode
  })
  const progressContainer = document.getElementById('progress-container')
  if (progressContainer) {
    progressContainer.appendChild(progressBar.root)
  }

  // Load orbit data
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)

  console.log(`[DataMode] Loaded ${orbitsData.orbits.length} C4 orbits`)

  // Setup theme
  const cleanupTheme = setupTheme(header.elements.themeToggle, () => {
    // Data mode doesn't need canvas re-rendering
  })

  // State
  let stopLoop: (() => void) | null = null
  let isPaused = false
  let stepsPerSecond = 200

  const btnStop = document.getElementById('btn-stop') as HTMLButtonElement
  const btnPause = document.getElementById('btn-pause') as HTMLButtonElement
  const btnClear = document.getElementById('btn-clear') as HTMLButtonElement
  const speedSlider = document.getElementById(
    'speed-slider',
  ) as HTMLInputElement
  const speedValue = document.getElementById('speed-value') as HTMLSpanElement

  // Update UI helper functions
  function updateCurrentRunDisplay(state: DataModeState) {
    const currentRuleset = document.getElementById('current-ruleset')
    const currentHex = document.getElementById('current-hex')
    const currentSteps = document.getElementById('current-steps')
    const currentSps = document.getElementById('current-sps')
    const currentInterest = document.getElementById('current-interest')

    if (currentRuleset)
      currentRuleset.textContent = `${state.rulesetName} (Round ${state.roundCount})`
    if (currentHex) currentHex.textContent = state.rulesetHex
    if (currentSteps)
      currentSteps.textContent = `${state.currentStep} / ${state.totalSteps}`

    if (currentSps && state.actualSps !== undefined) {
      currentSps.textContent = `${Math.round(state.actualSps)}/sec`
    }

    if (currentInterest && state.interestScore !== undefined) {
      currentInterest.textContent = state.interestScore.toFixed(1)
    }

    const progress = (state.currentStep / state.totalSteps) * 100
    progressBar.set(Math.round(progress))
  }

  function updateStatsDisplay() {
    const stats = loadDataStats()

    const statRounds = document.getElementById('stat-rounds')
    const statSteps = document.getElementById('stat-steps')
    const statTime = document.getElementById('stat-time')
    const statRulesets = document.getElementById('stat-rulesets')
    const statSaved = document.getElementById('stat-saved')
    const statErrors = document.getElementById('stat-errors')

    if (statRounds) statRounds.textContent = stats.roundCount.toLocaleString()
    if (statSteps) statSteps.textContent = stats.totalSteps.toLocaleString()
    if (statTime)
      statTime.textContent = formatDuration(stats.totalComputeTimeMs)
    if (statRulesets)
      statRulesets.textContent = stats.uniqueRulesets.length.toLocaleString()
    if (statSaved) statSaved.textContent = stats.runsSaved.toLocaleString()
    if (statErrors) statErrors.textContent = stats.saveErrors.toLocaleString()
  }

  function updateHighScoresDisplay() {
    const stats = loadDataStats()
    const container = document.getElementById('high-scores-content')

    if (!container) return

    if (stats.highScores.length === 0) {
      container.innerHTML =
        '<div class="text-gray-600 dark:text-gray-400 text-center py-4">No scores yet</div>'
      return
    }

    container.innerHTML = stats.highScores
      .slice(0, 5)
      .map((score, index) => {
        const timeAgo = formatTimeAgo(Date.now() - score.timestamp)
        return `
          <div class="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700 last:border-0">
            <div class="flex items-center gap-2">
              <span class="text-gray-500 dark:text-gray-400 font-mono">${index + 1}.</span>
              <span class="text-gray-900 dark:text-white font-mono text-xs">${score.rulesetName}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-green-600 dark:text-green-500 font-bold">${score.interestScore.toFixed(1)}</span>
              <span class="text-gray-500 dark:text-gray-400 text-xs">${timeAgo}</span>
            </div>
          </div>
        `
      })
      .join('')
  }

  // Button handlers
  btnStop.addEventListener('click', () => {
    console.log('[DataMode] Stop button clicked')
    stopLoop?.()
    window.location.href = `${window.location.origin}${window.location.pathname}`
  })

  btnPause.addEventListener('click', () => {
    isPaused = !isPaused
    console.log(`[DataMode] ${isPaused ? 'Paused' : 'Resumed'}`)
    btnPause.textContent = isPaused ? 'Resume' : 'Pause'
    btnPause.className = isPaused
      ? 'px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors'
      : 'px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded transition-colors'
  })

  btnClear.addEventListener('click', () => {
    if (confirm('Clear all accumulated data? This cannot be undone.')) {
      console.log('[DataMode] Clearing data')
      clearDataStats()
      updateStatsDisplay()
      updateHighScoresDisplay()
    }
  })

  // Speed slider handler
  speedSlider.addEventListener('input', () => {
    const value = Number.parseInt(speedSlider.value, 10)
    if (value >= 1000) {
      stepsPerSecond = 0 // 0 means unlimited
      speedValue.textContent = 'Unlimited'
      console.log('[DataMode] Unlimited speed enabled')
    } else {
      stepsPerSecond = value
      speedValue.textContent = `${value}/sec`
      console.log(`[DataMode] Steps/sec set to ${stepsPerSecond}`)
    }
  })

  // Auto-refresh stats display
  const statsInterval = setInterval(() => {
    updateStatsDisplay()
    updateHighScoresDisplay()
  }, 1000)

  // Initial display
  updateStatsDisplay()
  updateHighScoresDisplay()

  // Start the data generation loop
  console.log('[DataMode] Starting simulation loop')
  stopLoop = await runDataLoop(
    orbitLookup,
    (state) => {
      if (!isPaused) {
        updateCurrentRunDisplay(state)
      }
    },
    () => isPaused,
    () => stepsPerSecond,
  )

  // Cleanup
  return () => {
    console.log('[DataMode] Cleanup')
    stopLoop?.()
    clearInterval(statsInterval)
    cleanupTheme()
  }
}
