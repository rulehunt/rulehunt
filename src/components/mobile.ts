import { saveRun } from '../api/save'
import { CellularAutomata } from '../cellular-automata.ts'
import { getUserIdentity } from '../identity.ts'
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

// --- Color Palettes --------------------------------------------------------
const LIGHT_FG_COLORS = [
  '#2563eb', // blue-600
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#7c3aed', // violet-600
  '#0d9488', // teal-600
]

const DARK_FG_COLORS = [
  '#60a5fa', // blue-400
  '#f87171', // red-400
  '#4ade80', // green-400
  '#c084fc', // purple-400
  '#fb923c', // orange-400
  '#22d3ee', // cyan-400
  '#f472b6', // pink-400
  '#a3e635', // lime-400
  '#a78bfa', // violet-400
  '#2dd4bf', // teal-400
]

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

// --- Pinch-to-Zoom ----------------------------------------------------------
function setupPinchZoom(
  canvas: HTMLCanvasElement,
  onZoom: (scale: number, centerX: number, centerY: number) => void,
): CleanupFunction {
  let initialDistance = 0
  let currentScale = 1

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)

      // Midpoint between fingers
      const centerX = (t1.clientX + t2.clientX) / 2
      const centerY = (t1.clientY + t2.clientY) / 2

      if (!initialDistance) {
        initialDistance = distance
        return
      }

      const scaleChange = distance / initialDistance
      const newScale = Math.min(Math.max(currentScale * scaleChange, 0.5), 3)
      onZoom(newScale, centerX, centerY)
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) {
      currentScale = Math.min(Math.max(currentScale, 0.5), 3)
      initialDistance = 0
    }
  }

  canvas.addEventListener('touchmove', handleTouchMove)
  canvas.addEventListener('touchend', handleTouchEnd)
  canvas.addEventListener('touchcancel', handleTouchEnd)

  return () => {
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleTouchEnd)
    canvas.removeEventListener('touchcancel', handleTouchEnd)
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
    'fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 overflow-hidden'

  // Canvas wrapper for swipe animation
  const canvasWrapper = document.createElement('div')
  canvasWrapper.className = 'relative'
  canvasWrapper.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'

  const canvas = document.createElement('canvas')
  canvas.className = 'touch-none transition-transform duration-75 ease-out'

  const size = Math.min(window.innerWidth, window.innerHeight)
  canvas.width = size
  canvas.height = size
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
  canvas.style.transformOrigin = 'center center'

  // Detect theme and set initial color
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches
  const colorPalette = isDarkMode ? DARK_FG_COLORS : LIGHT_FG_COLORS
  let currentColorIndex = Math.floor(Math.random() * colorPalette.length)
  canvas.style.border = `4px solid ${colorPalette[currentColorIndex]}`
  canvas.style.borderRadius = '8px'

  document.documentElement.style.setProperty(
    '--canvas-fg',
    colorPalette[currentColorIndex],
  )

  canvasWrapper.appendChild(canvas)
  container.appendChild(canvasWrapper)

  // Instruction overlay
  const instruction = document.createElement('div')
  instruction.className =
    'fixed bottom-8 left-0 right-0 text-center text-gray-500 dark:text-gray-400 text-sm pointer-events-none transition-opacity duration-300'
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

  // Track if user has swiped
  let hasSwipedOnce = false

  // --- Simulation Setup -----------------------------------------------------
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)
  console.log(`Loaded ${orbitsData.orbits.length} C4 orbits`)

  const cellularAutomata = new CellularAutomata(canvas)
  const stepsPerSecond = 10

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
      // Hide instruction after first swipe
      if (!hasSwipedOnce) {
        hasSwipedOnce = true
        instruction.style.opacity = '0'
        setTimeout(() => {
          instruction.style.display = 'none'
        }, 300)
      }

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

      // Always compute fresh hex from current ruleset to avoid placeholder text
      const rulesetHex = c4RulesetToHex(currentRuleset)

      const interestScore = stats.calculateInterestScore()
      const watchedWallMs = stats.getElapsedTime()
      const actualSps = stats.getActualStepsPerSecond()
      const stepCount = metadata?.stepCount ?? 0

      const identity = getUserIdentity()
      const runPayload: RunSubmission = {
        userId: identity.userId,
        userLabel: identity.userLabel,
        rulesetName: currentRuleName,
        rulesetHex,
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

      // --- Swipe animation ---
      // Slide current canvas up
      canvasWrapper.style.transform = 'translateY(-100%)'

      setTimeout(() => {
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

        // Change to new color
        currentColorIndex = (currentColorIndex + 1) % colorPalette.length
        canvas.style.border = `4px solid ${colorPalette[currentColorIndex]}`

        // Add this line to update the foreground color:
        document.documentElement.style.setProperty(
          '--canvas-fg',
          colorPalette[currentColorIndex],
        )

        // Reset zoom when switching rules
        zoomScale = 1
        canvas.style.transform = 'scale(1)'
        canvas.style.transformOrigin = 'center center'

        // Reset position (slide in from bottom)
        canvasWrapper.style.transition = 'none'
        canvasWrapper.style.transform = 'translateY(100%)'

        // Force a reflow
        canvasWrapper.offsetHeight

        // Slide to center
        canvasWrapper.style.transition =
          'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
        canvasWrapper.style.transform = 'translateY(0)'

        console.log(`New rule: ${currentRuleName}`)
      }, 400) // Match the transition duration
    },
  })

  // --- Pinch Zoom Handler ---------------------------------------------------
  let zoomScale = 1
  const cleanupZoom = setupPinchZoom(canvas, (scale, cx, cy) => {
    zoomScale = scale
    const rect = canvas.getBoundingClientRect()
    const offsetX = cx - rect.left - rect.width / 2
    const offsetY = cy - rect.top - rect.height / 2
    canvas.style.transformOrigin = `${50 + (offsetX / rect.width) * 100}% ${
      50 + (offsetY / rect.height) * 100
    }%`
    canvas.style.transform = `scale(${zoomScale})`
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
    cleanupZoom()
    for (const { element, event, handler } of eventListeners) {
      element.removeEventListener(event, handler)
    }
    console.log('Mobile layout cleaned up')
  }
}
