import { CellularAutomata } from '../cellular-automata.ts'
import type { C4OrbitsData } from '../schema.ts'
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

// --- Swipe Detection --------------------------------------------------------
interface SwipeHandler {
  onSwipeUp: () => void
}

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
  // Track cleanup tasks
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

  // Create full-screen container
  const container = document.createElement('div')
  container.className =
    'fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900'

  // Create canvas
  const canvas = document.createElement('canvas')
  canvas.className = 'touch-none'

  const size = Math.min(window.innerWidth, window.innerHeight)
  canvas.width = size
  canvas.height = size
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`

  container.appendChild(canvas)

  // Add swipe instruction overlay
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

  // Load orbit data
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)

  console.log(`Loaded ${orbitsData.orbits.length} C4 orbits`)

  // Initialize cellular automata
  const cellularAutomata = new CellularAutomata(canvas)

  // Start with Conway
  let currentRuleset = makeC4Ruleset(conwayRule, orbitLookup)
  let currentRuleName = "Conway's Game of Life"

  // Initialize with patch seed
  cellularAutomata.patchSeed(50)

  // Auto-play at 10 steps per second
  const stepsPerSecond = 10
  const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
  cellularAutomata.play(stepsPerSecond, expanded)

  // Initialize simulation metadata
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

  // Setup swipe detection
  const cleanupSwipe = setupSwipeDetection(container, {
    onSwipeUp: () => {
      // Generate new random rule
      const density = Math.random() * 0.6 + 0.2 // 20-80% density
      currentRuleset = randomC4RulesetByDensity(density)
      currentRuleName = `Random (${Math.round(density * 100)}%)`

      // Stop current simulation
      cellularAutomata.pause()

      // Reset with new rule
      cellularAutomata.patchSeed(50)

      // Start playing with new rule
      const newExpanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, newExpanded)

      // Update metadata
      stats.initializeSimulation({
        name: `Mobile - ${currentRuleName}`,
        seedType: 'patch',
        seedPercentage: 50,
        rulesetName: currentRuleName,
        rulesetHex: c4RulesetToHex(currentRuleset),
        startTime: Date.now(),
        requestedStepsPerSecond: stepsPerSecond,
      })

      // Brief flash to indicate new rule
      instruction.style.opacity = '1'
      setTimeout(() => {
        instruction.style.opacity = '0.7'
      }, 200)

      console.log(`New rule: ${currentRuleName}`)
    },
  })

  // Handle window resize
  const resizeHandler = () => {
    const newSize = Math.min(window.innerWidth, window.innerHeight)
    canvas.style.width = `${newSize}px`
    canvas.style.height = `${newSize}px`
  }
  addEventListener(window, 'resize', resizeHandler)

  // Setup theme (dark mode support)
  const savedTheme =
    (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system'
  if (savedTheme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.classList.toggle('dark', isDark)
  } else {
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')
  }

  // Return cleanup function
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
