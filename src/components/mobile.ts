import { saveRun } from '../api/save'
import { CellularAutomata } from '../cellular-automata.ts'
import type { C4OrbitsData, RunSubmission } from '../schema.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  expandC4Ruleset,
  makeC4Ruleset,
  randomC4RulesetByDensity,
} from '../utils.ts'

// --- Types -----------------------------------------------------------------
export type CleanupFunction = () => void

interface SwipeHandler {
  onSwipeUp: () => void
}

// --- Swipe Detection --------------------------------------------------------
function setupSwipeDetection(
  element: HTMLElement,
  handler: SwipeHandler,
): CleanupFunction {
  let touchStartY = 0
  let touchStartTime = 0

  const handleTouchStart = (e: TouchEvent) => {
    touchStartY = e.touches[0].clientY
    touchStartTime = Date.now()
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const touchEndY = e.changedTouches[0].clientY
    const touchEndTime = Date.now()

    const deltaY = touchStartY - touchEndY
    const deltaTime = touchEndTime - touchStartTime
    const velocity = deltaY / deltaTime

    // Swipe up: positive deltaY, sufficient distance and velocity
    if (deltaY > 50 && velocity > 0.3) {
      handler.onSwipeUp()
    }
  }

  element.addEventListener('touchstart', handleTouchStart)
  element.addEventListener('touchend', handleTouchEnd)

  return () => {
    element.removeEventListener('touchstart', handleTouchStart)
    element.removeEventListener('touchend', handleTouchEnd)
  }
}

// --- Mobile Layout ----------------------------------------------------------
export async function setupMobileLayout(
  appRoot: HTMLDivElement,
): Promise<CleanupFunction> {
  const eventListeners: Array<{
    element: EventTarget
    event: string
    handler: EventListenerOrEventListenerObject
  }> = []

  const addEventListener = <K extends keyof HTMLElementEventMap>(
    element: EventTarget,
    event: K | string,
    handler:
      | EventListenerOrEventListenerObject
      | ((evt: HTMLElementEventMap[K]) => void),
  ) => {
    element.addEventListener(
      event as string,
      handler as EventListenerOrEventListenerObject,
    )
    eventListeners.push({
      element,
      event: event as string,
      handler: handler as EventListenerOrEventListenerObject,
    })
  }

  // --- UI Setup -------------------------------------------------------------
  const container = document.createElement('div')
  container.className =
    'fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900'

  const canvas = document.createElement('canvas')
  canvas.className = 'touch-none'

  const size = Math.min(window.innerWidth, window.innerHeight)
  canvas.width = size
  canvas.height = size
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`

  container.appendChild(canvas)

  // Instruction overlay
  const instruction = document.createElement('div')
  instruction.className =
    'fixed bottom-8 left-0 right-0 text-center text-gray-500 dark:text-gray-400 text-sm pointer-events-none'
  instruction.style.opacity = '0.7'
  instruction.innerHTML = `
    <div class="flex flex-col items-center gap-2">
      <svg class="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
      <span>Swipe up for new rule</span>
    </div>
  `
  container.appendChild(instruction)
  appRoot.appendChild(container)

  // --- Simulation Setup -----------------------------------------------------
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)
  console.log(`Loaded ${orbitsData.orbits.length} C4 orbits`)

  const cellularAutomata = new CellularAutomata(canvas)
  const stepsPerSecond = 10

  // Start with Conway
  let currentRuleset = makeC4Ruleset(conwayRule, orbitLookup)
  let currentRuleName = "Conway's Game of Life"

  cellularAutomata.patchSeed(50)
  const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
  cellularAutomata.play(stepsPerSecond, expanded)

  const stats = cellularAutomata.getStatistics()
  stats.initializeSimulation({
    name: `Mobile - ${currentRuleName}`,
    seedType: 'patch',
    seedPercentage: 50,
    rulesetName: currentRuleName,
    rulesetHex: c4RulesetToHex(currentRuleset),
    startTime: Date.now(),
    requestedStepsPerSecond: stepsPerSecond,
  })

  // --- Swipe Handler --------------------------------------------------------
  const cleanupSwipe = setupSwipeDetection(container, {
    onSwipeUp: () => {
      // --- Gather statistics before switching rule ---
      const metadata = stats.getMetadata()
      const recent = stats.getRecentStats(1)[0] ?? {
        population: 0,
        activity: 0,
        populationChange: 0,
        entropy2x2: 0,
        entropy4x4: 0,
        entropy8x8: 0,
      }

      const interestScore = stats.calculateInterestScore()
      const watchedWallMs = stats.getElapsedTime()
      const actualSps = stats.getActualStepsPerSecond()
      const stepCount = metadata?.stepCount ?? 0

      const runPayload: Omit<RunSubmission, 'userId' | 'userLabel'> = {
        rulesetName: metadata?.rulesetName ?? currentRuleName,
        rulesetHex: metadata?.rulesetHex ?? c4RulesetToHex(currentRuleset),
        seed: 0,
        seedType: (metadata?.seedType ?? 'patch') as
          | 'center'
          | 'random'
          | 'patch',
        seedPercentage: metadata?.seedPercentage ?? 50,
        stepCount,
        watchedSteps: stepCount,
        watchedWallMs,
        gridSize: undefined,
        progress_bar_steps: undefined,
        requestedSps: metadata?.requestedStepsPerSecond ?? stepsPerSecond,
        actualSps,
        population: recent.population,
        activity: recent.activity,
        populationChange: recent.populationChange,
        entropy2x2: recent.entropy2x2,
        entropy4x4: recent.entropy4x4,
        entropy8x8: recent.entropy8x8,
        interestScore,
        simVersion: 'v0.1.0',
        engineCommit: undefined,
        extraScores: undefined,
      }

      // --- Fire and forget background save ---
      setTimeout(() => {
        saveRun(runPayload).then((res) => {
          if (res.ok) {
            console.log(`[saveRun] ✅ recorded run ${res.runHash}`)
          } else {
            console.warn('[saveRun] ❌ failed to record run')
          }
        })
      }, 0)

      // --- Switch to new random rule ---
      const density = Math.random() * 0.6 + 0.2
      currentRuleset = randomC4RulesetByDensity(density)
      currentRuleName = `Random (${Math.round(density * 100)}%)`

      cellularAutomata.pause()
      cellularAutomata.patchSeed(50)
      const newExpanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, newExpanded)

      stats.initializeSimulation({
        name: `Mobile - ${currentRuleName}`,
        seedType: 'patch',
        seedPercentage: 50,
        rulesetName: currentRuleName,
        rulesetHex: c4RulesetToHex(currentRuleset),
        startTime: Date.now(),
        requestedStepsPerSecond: stepsPerSecond,
      })

      instruction.style.opacity = '1'
      setTimeout(() => {
        instruction.style.opacity = '0.7'
      }, 200)

      console.log(`New rule: ${currentRuleName}`)
    },
  })

  // --- Resize Handling ------------------------------------------------------
  const resizeHandler = () => {
    const newSize = Math.min(window.innerWidth, window.innerHeight)
    canvas.style.width = `${newSize}px`
    canvas.style.height = `${newSize}px`
  }
  addEventListener(window, 'resize', resizeHandler)

  // --- Cleanup --------------------------------------------------------------
  return () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
    }
    cleanupSwipe()
    for (const { element, event, handler } of eventListeners) {
      element.removeEventListener(event, handler)
    }
    console.log('Mobile layout cleaned up')
  }
}
