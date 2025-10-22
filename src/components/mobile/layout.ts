// src/components/mobile.ts
import { formatRulesetName, saveRun } from '../../api/save'
import { createCellularAutomata } from '../../cellular-automata-factory.ts'
import type { ICellularAutomata } from '../../cellular-automata-interface.ts'
import { getUserIdentity } from '../../identity.ts'
import type {
  C4OrbitsData,
  C4Ruleset,
  Ruleset,
  RunSubmission,
} from '../../schema.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  expandC4Ruleset,
  makeC4Ruleset,
  mutateC4Ruleset,
  randomC4RulesetByDensity,
} from '../../utils.ts'
import { createStatsOverlay, setupStatsOverlay } from './statsOverlay.ts'

import { fetchStarredPattern } from '../../api/starred.ts'
import { getRunStatsSnapshot } from '../../api/statistics-utils.ts'
import {
  parseURLRuleset,
  parseURLState,
  updateURLWithoutReload,
} from '../../urlState.ts'
import { hexToC4Ruleset } from '../../utils.ts'
import type { AudioEngine } from '../audioEngine.ts'
import { getVisualizationPalette } from '../shared/theme.ts'
import { createAutoFadeContainer } from './buttonContainer.ts'
import { createMobileHeader, setupMobileHeader } from './header.ts'
import { createRoundButton } from './roundButton.ts'
import { createStarButton } from './starButton.ts'
import { createShareButton } from './ui/shareButton.ts'
import { createSoftResetButton } from './ui/softResetButton.ts'
import { createStatsButton } from './ui/statsButton.ts'

// --- Constants --------------------------------------------------------------
const FORCE_RULE_ZERO_OFF = true // avoid strobing
const STEPS_PER_SECOND = 60
const TARGET_GRID_SIZE = 600_000
// Exploration/Exploitation/Mutation Strategy:
// 20% random - Generate completely new random rule (exploration)
// 10% exact starred - Load exact starred pattern from database (exploitation)
// 70% mutated starred - Load starred pattern and mutate it with ramping magnitude (balanced)

const SWIPE_COMMIT_THRESHOLD_PERCENT = 0.1
const SWIPE_COMMIT_MIN_DISTANCE = 50
const SWIPE_VELOCITY_THRESHOLD = -0.3
const SWIPE_FAST_THROW_THRESHOLD = -0.5

// Visualization palettes now managed by getVisualizationPalette() from '../shared/theme.ts'

// --- Types ------------------------------------------------------------------

import type { CleanupFunction } from '../../types'

// Runtime rule container used only on mobile.ts.
// Combines a C4 or expanded ruleset plus optional cached expansion.
// For starred patterns, also includes the saved seed for exact reproduction.
export type RuleData = {
  name: string
  hex: string
  ruleset: C4Ruleset | Ruleset
  expanded?: Ruleset
  seed?: number // Saved seed from starred pattern (for exact reproduction)
}

// --- Cellular Automata Engine  ----------------------------------------------
function createCA(
  canvas: HTMLCanvasElement,
  gridRows: number,
  gridCols: number,
  fgColor: string,
  bgColor: string,
  onDiedOut?: () => void,
): ICellularAutomata {
  return createCellularAutomata(canvas, {
    gridRows,
    gridCols,
    fgColor,
    bgColor,
    onDiedOut,
    // Use default threshold (250K cells = 500x500)
    // Mobile targets ~600K cells, so will use GPU on most devices
  })
}

// --- Helpers ----------------------------------------------------------------
function computeAdaptiveGrid(
  maxCells = TARGET_GRID_SIZE,
  containerElement?: HTMLElement,
) {
  // Use container dimensions if provided (for mobile preview), otherwise use window
  const screenWidth = containerElement
    ? containerElement.clientWidth
    : window.innerWidth
  const screenHeight = containerElement
    ? containerElement.clientHeight
    : window.innerHeight

  // Guard against zero or negative screen dimensions
  if (screenWidth <= 0 || screenHeight <= 0) {
    console.warn(
      `[computeAdaptiveGrid] Invalid screen dimensions: ${screenWidth}×${screenHeight} - using fallback`,
    )
    return {
      gridCols: 100,
      gridRows: 100,
      cellSize: 1,
      totalCells: 10000,
      screenWidth: 100,
      screenHeight: 100,
    }
  }

  let cellSize = 1
  let gridCols = screenWidth
  let gridRows = screenHeight
  let totalCells = gridCols * gridRows

  while (totalCells > maxCells) {
    cellSize += 1
    gridCols = Math.floor(screenWidth / cellSize)
    gridRows = Math.floor(screenHeight / cellSize)
    totalCells = gridCols * gridRows
  }

  // Ensure we never return 0 dimensions
  gridCols = Math.max(1, gridCols)
  gridRows = Math.max(1, gridRows)
  totalCells = gridCols * gridRows

  return { gridCols, gridRows, cellSize, totalCells, screenWidth, screenHeight }
}

function initializeRunStats(ca: ICellularAutomata, rule: RuleData) {
  ca.getStatistics().initializeSimulation({
    name: `Mobile - ${rule.name}`,
    seedType: 'patch',
    seedPercentage: 50,
    rulesetName: rule.name,
    rulesetHex: rule.hex,
    startTime: Date.now(),
    requestedStepsPerSecond: STEPS_PER_SECOND,
  })
}

// --- Dual-Canvas Swipe Handler ----------------------------------------------
// Swipe Flow (timing carefully orchestrated to prevent flashing):
// 1. Touch start → pause onScreen CA (both canvases now static)
// 2. Touch move → animate both static canvases (TikTok-style scroll)
// 3. Commit decision → run transition animation (incoming canvas already has next rule)
// 4. After animation → wait one frame, then onCommit swaps references
// 5. onCommit defers CA operations by 16ms to let browser finish compositing:
//    - Starts playing new onScreen CA
//    - Prepares offScreen canvas with fresh rule for NEXT swap
// This timing eliminates race conditions and prevents visible flashes
let isTransitioning = false
let offscreenReady = false
let swipeLockUntil = 0
let gestureId = 0
function setupDualCanvasSwipe(
  wrapper: HTMLElement,
  canvas1: HTMLCanvasElement,
  canvas2: HTMLCanvasElement,
  onCommit: () => void,
  onCancel: () => void,
  onDragStart?: () => void,
): CleanupFunction {
  // Track which canvas is currently on-screen (true = canvas1, false = canvas2)
  let canvas1IsOnScreen = true

  let startY = 0
  let currentY = 0
  let startT = 0
  let dragging = false
  let directionLocked: 'up' | 'down' | null = null
  let pausedForDrag = false

  const samples: { t: number; y: number }[] = []
  const getHeight = () => wrapper.clientHeight

  // Helper to get current canvas roles based on tracking variable
  const getCurrentCanvases = () => {
    return canvas1IsOnScreen
      ? { onScreen: canvas1, offScreen: canvas2 }
      : { onScreen: canvas2, offScreen: canvas1 }
  }

  const resetTransforms = (h: number) => {
    const { onScreen, offScreen } = getCurrentCanvases()
    onScreen.style.transform = 'translateY(0)'
    offScreen.style.transform = `translateY(${h}px)`
  }

  function waitForTransitionEndScoped(
    el: HTMLElement,
    id: number,
  ): Promise<void> {
    return new Promise((resolve) => {
      const done = (ev: TransitionEvent) => {
        el.removeEventListener('transitionend', done)
        if (ev.propertyName === 'transform' && id === gestureId) {
          resolve()
        }
      }
      el.addEventListener('transitionend', done)
    })
  }

  const handleTouchStart = (e: TouchEvent) => {
    if (!offscreenReady) return

    const now = performance.now()

    if (now < swipeLockUntil) {
      e.preventDefault()
      e.stopPropagation()
      return
    }

    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '[data-swipe-ignore="true"], button, a, input, select, textarea',
      )
    ) {
      return
    }

    if (e.touches.length !== 1) return
    if (isTransitioning) return

    gestureId++

    startY = e.touches[0].clientY
    currentY = startY
    startT = e.timeStamp
    directionLocked = null
    dragging = true
    pausedForDrag = false
    samples.length = 0
    samples.push({ t: startT, y: startY })

    const { onScreen, offScreen } = getCurrentCanvases()
    wrapper.style.transition = 'none'
    onScreen.style.transition = 'none'
    offScreen.style.transition = 'none'
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    const y = e.touches[0].clientY
    const dy = y - startY
    const absDy = Math.abs(dy)

    // Lock direction with a little hysteresis
    if (!directionLocked && absDy > 8) {
      directionLocked = dy < 0 ? 'up' : 'down'
      // Pause only when we know it's an upward swipe (real intent)
      if (directionLocked === 'up' && !pausedForDrag) {
        onDragStart?.()
        pausedForDrag = true
      }
    }

    // Reject downward gestures early & visibly snap back
    if (directionLocked === 'down') {
      dragging = false
      const h = getHeight()
      resetTransforms(h)
      onCancel()
      return
    }

    currentY = y
    samples.push({ t: e.timeStamp, y })
    const cutoff = e.timeStamp - 100
    while (samples.length > 2 && samples[0].t < cutoff) samples.shift()

    const delta = Math.min(0, dy)
    const height = getHeight()

    const { onScreen, offScreen } = getCurrentCanvases()
    onScreen.style.transform = `translateY(${delta}px)`
    offScreen.style.transform = `translateY(${height + delta}px)`
  }

  const doCancel = async () => {
    const { onScreen, offScreen } = getCurrentCanvases()
    const height = getHeight()
    const duration = 0.25
    const transition = `transform ${duration}s cubic-bezier(0.4,0,0.2,1)`

    const targetOnScreen = 'translateY(0)'
    const targetOffScreen = `translateY(${height}px)`

    const curOnScreen = onScreen.style.transform || ''
    const curOffScreen = offScreen.style.transform || ''

    // Fast path: already in place — skip transitions entirely
    if (curOnScreen === targetOnScreen && curOffScreen === targetOffScreen) {
      onScreen.style.transition = 'none'
      offScreen.style.transition = 'none'
      onCancel()
      return
    }

    onScreen.style.transition = transition
    offScreen.style.transition = transition
    onScreen.style.transform = targetOnScreen
    offScreen.style.transform = targetOffScreen

    // Safety timeout in case transitionend never fires
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, duration * 1000 + 50),
    )

    await Promise.race([
      Promise.all([
        waitForTransitionEndScoped(onScreen, gestureId),
        waitForTransitionEndScoped(offScreen, gestureId),
      ]),
      timeout,
    ])

    onScreen.style.transition = 'none'
    offScreen.style.transition = 'none'
    onCancel()
  }

  const handleTouchEndCore = async (forceCancel = false) => {
    const wasDragging = dragging
    const lockedDirection = directionLocked
    dragging = false

    const delta = currentY - startY
    const dragDistance = Math.abs(delta)
    const tinyAccidentalMove = dragDistance < 15

    if (
      !wasDragging ||
      forceCancel ||
      lockedDirection === 'down' ||
      tinyAccidentalMove
    ) {
      await doCancel()
      swipeLockUntil = performance.now() + 350
      return
    }

    const height = getHeight()

    // Compute velocity
    let vy = 0
    if (samples.length >= 2) {
      const a = samples[0]
      const b = samples[samples.length - 1]
      const dt = Math.max(1, b.t - a.t)
      vy = (b.y - a.y) / dt
    }

    const slowPullback = delta > 0
    const fastFlick = vy < SWIPE_FAST_THROW_THRESHOLD
    const normalFlick =
      dragDistance > height * SWIPE_COMMIT_THRESHOLD_PERCENT ||
      (dragDistance > SWIPE_COMMIT_MIN_DISTANCE &&
        vy < SWIPE_VELOCITY_THRESHOLD)

    const shouldCommit =
      height > 0 &&
      dragDistance > 0 &&
      !tinyAccidentalMove &&
      !slowPullback &&
      (fastFlick || normalFlick)

    // Fast path for taps: if almost no drag, skip animations entirely
    if (!shouldCommit && tinyAccidentalMove) {
      const { onScreen, offScreen } = getCurrentCanvases()
      const h = getHeight()
      onScreen.style.transition = 'none'
      offScreen.style.transition = 'none'
      onScreen.style.transform = 'translateY(0)'
      offScreen.style.transform = `translateY(${h}px)`
      onCancel()
      return
    }

    const { onScreen, offScreen } = getCurrentCanvases()
    const duration = shouldCommit ? 0.35 : 0.25
    const transition = `transform ${duration}s cubic-bezier(0.4,0,0.2,1)`
    onScreen.style.transition = transition
    offScreen.style.transition = transition
    void onScreen.offsetWidth

    isTransitioning = true

    if (shouldCommit) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      const bgColor = isDark ? '#111827' : '#ffffff' // gray-900 : white

      requestAnimationFrame(() => {
        // Explicitly fill background before rendering to prevent black flash
        const ctx = offScreen.getContext('2d')
        if (ctx) {
          ctx.save()
          ctx.fillStyle = bgColor
          ctx.fillRect(0, 0, offScreen.width, offScreen.height)
          ctx.restore()
        }
      })

      // Normal upward slide
      onScreen.style.transform = `translateY(-${height}px)`
      offScreen.style.transform = 'translateY(0)'

      await Promise.all([
        waitForTransitionEndScoped(onScreen, gestureId),
        waitForTransitionEndScoped(offScreen, gestureId),
      ])

      onScreen.style.transition = 'none'
      offScreen.style.transition = 'none'
      onScreen.style.transform = `translateY(-${height}px)`
      offScreen.style.transform = 'translateY(0)'

      // Toggle the tracking flag BEFORE calling onCommit
      canvas1IsOnScreen = !canvas1IsOnScreen

      requestAnimationFrame(() => onCommit())
    } else {
      await doCancel()
    }

    isTransitioning = false
    swipeLockUntil = performance.now() + 350
  }

  const handleTouchEnd = (_: TouchEvent) => {
    void handleTouchEndCore(false)
  }
  const handleTouchCancel = (_: TouchEvent) => {
    void handleTouchEndCore(true)
  }

  // Mouse event handlers (for desktop testing)
  const handleMouseDown = (e: MouseEvent) => {
    // Check if clicking on button or other interactive element (same as touch handler)
    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '[data-swipe-ignore="true"], button, a, input, select, textarea',
      )
    ) {
      return
    }

    // Convert mouse event to touch-like event
    const fakeTouch = {
      ...e,
      touches: [
        {
          clientX: e.clientX,
          clientY: e.clientY,
        } as Touch,
      ] as unknown as TouchList,
    } as unknown as TouchEvent
    handleTouchStart(fakeTouch)
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    const fakeTouch = {
      ...e,
      touches: [
        {
          clientX: e.clientX,
          clientY: e.clientY,
        } as Touch,
      ] as unknown as TouchList,
    } as unknown as TouchEvent
    handleTouchMove(fakeTouch)
  }

  const handleMouseUp = (e: MouseEvent) => {
    if (!dragging) return
    const fakeTouch = e as unknown as TouchEvent
    handleTouchEnd(fakeTouch)
  }

  // Add both touch and mouse event listeners
  // touchstart NOT passive so we can preventDefault() during swipe lock
  // touchmove CAN be passive since we never preventDefault() on it
  wrapper.addEventListener('touchstart', handleTouchStart, { passive: false })
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: true })
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: true })
  wrapper.addEventListener('touchcancel', handleTouchCancel, { passive: true })

  wrapper.addEventListener('mousedown', handleMouseDown)
  window.addEventListener('mousemove', handleMouseMove)
  window.addEventListener('mouseup', handleMouseUp)

  return () => {
    wrapper.removeEventListener('touchstart', handleTouchStart)
    wrapper.removeEventListener('touchmove', handleTouchMove)
    wrapper.removeEventListener('touchend', handleTouchEnd)
    wrapper.removeEventListener('touchcancel', handleTouchCancel)

    wrapper.removeEventListener('mousedown', handleMouseDown)
    window.removeEventListener('mousemove', handleMouseMove)
    window.removeEventListener('mouseup', handleMouseUp)
  }
}

// Zoom Buttons (pinch gesture is hard!)

function createZoomButtons(
  parent: HTMLElement,
  getCAs: () => [ICellularAutomata, ICellularAutomata],
): CleanupFunction {
  const zoomFactor = 3

  // Create auto-fade container for zoom controls
  const {
    container,
    resetFade,
    cleanup: cleanupContainer,
  } = createAutoFadeContainer({
    position: { bottom: '16px', left: '16px' },
    fadeAfterMs: 3000,
    fadedOpacity: 0.3,
    className: 'flex flex-col space-y-2',
  })

  // Create zoom in button
  const zoomInBtn = createRoundButton({
    icon: '+',
    title: 'Zoom in',
    className:
      'w-10 h-10 flex items-center justify-center text-lg active:scale-95',
    onClick: () => {
      const [ca1, ca2] = getCAs()
      const current = ca1.getZoom?.() ?? 1
      const newZoom = Math.min(100, current * zoomFactor)
      ca1.setZoom(newZoom)
      ca2.setZoom(newZoom)
      resetFade()
    },
  })

  // Create zoom out button
  const zoomOutBtn = createRoundButton({
    icon: '–',
    title: 'Zoom out',
    className:
      'w-10 h-10 flex items-center justify-center text-lg active:scale-95',
    onClick: () => {
      const [ca1, ca2] = getCAs()
      const current = ca1.getZoom?.() ?? 1
      const newZoom = Math.max(1, current / zoomFactor)
      ca1.setZoom(newZoom)
      ca2.setZoom(newZoom)
      resetFade()
    },
  })

  container.appendChild(zoomInBtn.button)
  container.appendChild(zoomOutBtn.button)
  parent.appendChild(container)
  resetFade()

  return () => {
    zoomInBtn.cleanup()
    zoomOutBtn.cleanup()
    cleanupContainer()
  }
}

// --- Helper: Rule generation and loading ------------------------------------
function generateRandomRule(): RuleData {
  const density = Math.random() * 0.6 + 0.2
  const ruleset = randomC4RulesetByDensity(density, FORCE_RULE_ZERO_OFF)
  return {
    name: formatRulesetName('random', density * 100),
    hex: c4RulesetToHex(ruleset),
    ruleset,
  }
}

/**
 * Exploration/Exploitation/Mutation Strategy:
 * - 0.0–0.2: return a brand new random rule
 * - 0.2–0.9: fetch a starred rule, then mutate it with increasing magnitude
 * - 0.9–1.0: fetch and return starred rule unmodified
 */
async function generateNextRule(): Promise<RuleData> {
  const r = Math.random()

  // 20% random (0.0 - 0.2)
  if (r < 0.2) {
    console.log('[generateNextRule] Strategy: Random')
    return generateRandomRule()
  }

  // Try to fetch a starred pattern for both exact and mutation cases
  try {
    const starred = await fetchStarredPattern()
    if (!starred) {
      console.warn(
        '[generateNextRule] No starred pattern returned, using random',
      )
      return generateRandomRule()
    }

    const ruleset = hexToC4Ruleset(starred.ruleset_hex)

    // 10% exact starred (0.9 - 1.0)
    if (r > 0.9) {
      console.log(
        '[generateNextRule] Strategy: Exact starred -',
        starred.ruleset_name,
        'seed:',
        starred.seed,
      )
      return {
        name: starred.ruleset_name,
        hex: starred.ruleset_hex,
        ruleset,
        seed: starred.seed, // Include saved seed for exact reproduction
      }
    }

    // 70% mutated starred (0.2 - 0.9)
    // Map r in [0.2, 0.9] to normalized value in [0.0, 1.0]
    const normalized = (r - 0.2) / 0.7
    // Then invert to get mutation magnitude: 1.0 at r=0.2, decreasing to 0.0 at r=0.9
    const magnitude = 1.0 - normalized
    const mutated = mutateC4Ruleset(ruleset, magnitude, FORCE_RULE_ZERO_OFF)
    const mutatedHex = c4RulesetToHex(mutated)
    console.log(
      `[generateNextRule] Strategy: Mutated starred (magnitude=${magnitude.toFixed(2)}) - based on`,
      starred.ruleset_name,
    )
    return {
      name: `${starred.ruleset_name} (mutated)`,
      hex: mutatedHex,
      ruleset: mutated,
      // Don't include seed - let it be random for mutations
    }
  } catch (err) {
    console.warn(
      '[generateNextRule] Failed to fetch starred pattern, falling back to random:',
      err,
    )
    return generateRandomRule()
  }
}

// --- Explicit rule setup and play functions ---------------------------------

/**
 * Prepare a CA with the given rule and seed, paused and rendered.
 * All operations are explicit - no hidden side effects.
 * If the rule contains a saved seed (from starred pattern), apply it for exact reproduction.
 */
function prepareAutomata(
  cellularAutomata: ICellularAutomata,
  rule: RuleData,
  orbitLookup: Uint8Array,
  seedPercentage = 50,
): void {
  cellularAutomata.pause()
  cellularAutomata.clearGrid()

  // If rule has a saved seed (starred pattern), apply it for exact reproduction
  if (rule.seed !== undefined) {
    cellularAutomata.setSeed(rule.seed)
    console.log('[prepareAutomata] Applied saved seed:', rule.seed)
  }

  cellularAutomata.patchSeed(seedPercentage)

  if (!rule.expanded && (rule.ruleset as number[]).length === 140) {
    rule.expanded = expandC4Ruleset(rule.ruleset as C4Ruleset, orbitLookup)
  }
  cellularAutomata.render()
}

/**
 * Soft reset the CA.
 */
function softResetAutomata(cellularAutomata: ICellularAutomata): void {
  cellularAutomata.pause()
  cellularAutomata.clearGrid()
  cellularAutomata.softReset()
  cellularAutomata.render()
}

/**
 * Start or resume the CA with its expanded rule.
 */
function startAutomata(
  cellularAutomata: ICellularAutomata,
  rule: RuleData,
): void {
  const expanded = rule.expanded ?? rule.ruleset
  cellularAutomata.play(STEPS_PER_SECOND, expanded)
}

// --- Save run ---------------------------------------------------------------
export function saveRunStatistics(
  cellularAutomata: ICellularAutomata,
  ruleName: string,
  ruleHex: string,
  isStarred = false,
): Promise<string | undefined> {
  const stats = cellularAutomata.getStatistics()
  const { metadata, recent } = getRunStatsSnapshot(cellularAutomata)

  const payload: RunSubmission = {
    userId: getUserIdentity().userId,
    userLabel: getUserIdentity().userLabel,
    rulesetName: ruleName,
    rulesetHex: ruleHex,
    seed: cellularAutomata.getSeed(),
    seedType: (metadata?.seedType ?? 'patch') as 'center' | 'random' | 'patch',
    seedPercentage: metadata?.seedPercentage ?? 50,
    stepCount: metadata?.stepCount ?? 0,
    watchedSteps: metadata?.stepCount ?? 0,
    watchedWallMs: stats.getElapsedTime(),
    gridSize: cellularAutomata.getGridSize(),
    progress_bar_steps: undefined,
    requestedSps: metadata?.requestedStepsPerSecond ?? STEPS_PER_SECOND,
    actualSps: stats.getActualStepsPerSecond(),
    population: recent.population,
    activity: recent.activity,
    populationChange: recent.populationChange,
    entropy2x2: recent.entropy2x2,
    entropy4x4: recent.entropy4x4,
    entropy8x8: recent.entropy8x8,
    entityCount: recent.entityCount,
    entityChange: recent.entityChange,
    totalEntitiesEverSeen: recent.totalEntitiesEverSeen,
    uniquePatterns: recent.uniquePatterns,
    entitiesAlive: recent.entitiesAlive,
    entitiesDied: recent.entitiesDied,
    interestScore: stats.calculateInterestScore(),
    isStarred,
    simVersion: 'v0.1.0',
    engineCommit: undefined,
    extraScores: undefined,
  }

  // --- Fire and forget background save ---
  return new Promise<string | undefined>((resolve) => {
    setTimeout(async () => {
      const result = await saveRun(payload)
      resolve(result.ok ? result.runHash : undefined)
    })
  })
}

// --- Main -------------------------------------------------------------------
export async function setupMobileLayout(
  appRoot: HTMLDivElement,
): Promise<CleanupFunction> {
  const container = document.createElement('div')
  // Use absolute positioning instead of fixed to work correctly inside preview frame
  container.className =
    'absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 overflow-hidden'
  container.style.touchAction = 'none' // Prevent all default touch behaviors including scroll

  // Create mobile header and wrap in positioned container
  const { root: headerRoot, elements: headerElements } = createMobileHeader()
  const headerWrapper = document.createElement('div')
  headerWrapper.className = 'absolute top-0 left-0 right-0 z-50'
  headerWrapper.appendChild(headerRoot)

  // Wrap info overlay in positioned container for mobile preview compatibility
  // Use pointer-events-none so it doesn't block clicks when overlay is hidden
  // z-[1001] to be above instruction overlay (z-1000)
  const overlayWrapper = document.createElement('div')
  overlayWrapper.className = 'absolute inset-0 z-[1001] pointer-events-none'
  overlayWrapper.appendChild(headerElements.infoOverlay)
  container.appendChild(overlayWrapper)

  const { cleanup: cleanupHeader, resetFade: resetHeaderFade } =
    setupMobileHeader(headerElements, headerRoot, overlayWrapper)
  container.appendChild(headerWrapper)

  // Audio engine setup
  // Ensure sound is disabled by default on mobile
  localStorage.setItem('sound-enabled', 'false')
  const audioEngine: AudioEngine | null = null
  const audioEnabled = false
  const audioInitialized = false

  // Helper function to update header title color and reset fade
  const updateHeaderColor = (color: string) => {
    headerElements.titleElement.style.color = color
    resetHeaderFade()
  }

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const palette = getVisualizationPalette(isDark)
  const bgColor = isDark ? '#111827' : '#ffffff' // gray-900 : white
  let colorIndex = Math.floor(Math.random() * palette.length)

  const wrapper = document.createElement('div')
  wrapper.className = 'relative overflow-hidden'

  // Create both canvases with semantic initial roles
  // Sizes will be set after appRoot is appended and we can measure its dimensions
  const createCanvas = () => {
    const c = document.createElement('canvas')
    c.className = 'absolute inset-0 touch-none'
    c.style.willChange = 'transform'
    return c
  }

  let onScreenCanvas = createCanvas()
  let offScreenCanvas = createCanvas()

  onScreenCanvas.style.zIndex = '1' // Behind buttons (z-10)
  onScreenCanvas.style.pointerEvents = 'none' // Let events fall through to wrapper for swipe handling
  onScreenCanvas.style.visibility = 'visible'

  offScreenCanvas.style.zIndex = '1' // Same level as onscreen
  offScreenCanvas.style.pointerEvents = 'none'
  offScreenCanvas.style.visibility = 'visible'

  wrapper.appendChild(onScreenCanvas)
  wrapper.appendChild(offScreenCanvas)
  container.appendChild(wrapper)

  // Instruction - positioned at 20% from bottom, centered horizontally
  const instruction = document.createElement('div')
  instruction.className =
    'absolute left-1/2 -translate-x-1/2 text-center text-gray-700 dark:text-gray-300 text-sm pointer-events-none transition-opacity duration-300'
  instruction.style.opacity = '0.9'
  instruction.style.zIndex = '1000'
  instruction.style.transition = 'opacity 0.6s ease'
  instruction.style.bottom = '20%'

  // Custom animation for gentle vertical pulse
  const style = document.createElement('style')
  style.textContent = `
    @keyframes arrow-pulse {
      0%, 100% { transform: scaleY(1) translateY(0); }
      50% { transform: scaleY(1.15) translateY(-2px); }
    }
    .arrow-pulse {
      animation: arrow-pulse 2s ease-in-out infinite;
      transform-origin: bottom center;
    }
    .instruction-oval {
      background: rgba(255, 255, 255, 0.5);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-radius: 9999px;
      padding: 14px 40px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
      white-space: nowrap;
    }
    @media (prefers-color-scheme: dark) {
      .instruction-oval {
        background: rgba(31, 41, 55, 0.5);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      }
    }
  `
  document.head.appendChild(style)

  instruction.innerHTML = `<div class="instruction-oval flex flex-col items-center gap-2">
      <svg class="w-6 h-6 arrow-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
      </svg><span>Swipe up for new rule</span></div>`
  container.appendChild(instruction)
  appRoot.appendChild(container)

  // Wait for layout to complete so dimensions are available
  await new Promise((resolve) => requestAnimationFrame(resolve))

  const res = await fetch('./resources/c4-orbits.json')
  const orbits: C4OrbitsData = await res.json()
  const lookup = buildOrbitLookup(orbits)

  // Compute grid size
  // Use appRoot dimensions only if it has valid size (for desktop preview)
  // Otherwise use window dimensions (for actual mobile)
  const useContainer = appRoot.clientWidth > 0 && appRoot.clientHeight > 0
  const {
    gridCols,
    gridRows,
    cellSize,
    totalCells,
    screenWidth,
    screenHeight,
  } = computeAdaptiveGrid(TARGET_GRID_SIZE, useContainer ? appRoot : undefined)

  console.log(
    `[grid] ${gridCols}×${gridRows} = ${totalCells.toLocaleString()} cells @ cellSize=${cellSize}px`,
  )

  wrapper.style.width = `${screenWidth}px`
  wrapper.style.height = `${screenHeight}px`

  for (const canvas of [onScreenCanvas, offScreenCanvas]) {
    canvas.width = screenWidth
    canvas.height = screenHeight
    canvas.style.width = `${screenWidth}px`
    canvas.style.height = `${screenHeight}px`
  }

  // Set initial offscreen transform
  offScreenCanvas.style.transform = `translateY(${screenHeight}px)`

  // Callback placeholder for died-out detection (set after button creation)
  // biome-ignore lint/style/useConst: reassigned later at line 1207
  let onDiedOutCallback: (() => void) | undefined

  // Create cellular automata instances
  let onScreenCA = createCA(
    onScreenCanvas,
    gridRows,
    gridCols,
    palette[colorIndex],
    bgColor,
    () => onDiedOutCallback?.(),
  )

  let offScreenCA = createCA(
    offScreenCanvas,
    gridRows,
    gridCols,
    palette[(colorIndex + 1) % palette.length],
    bgColor,
  )

  // Parse URL state for shareable links
  const urlState = parseURLState()
  const urlRuleset = parseURLRuleset()

  // Determine initial rule (URL takes precedence over default Conway)
  let onScreenRule: RuleData
  if (urlRuleset) {
    onScreenRule = {
      name: 'Shared Rule',
      hex: urlRuleset.hex,
      ruleset: urlRuleset.ruleset,
    }
    console.log('[mobile] Loaded rule from URL:', urlRuleset.hex)
  } else {
    const conway = makeC4Ruleset(conwayRule, lookup)
    onScreenRule = {
      name: "Conway's Game of Life",
      hex: c4RulesetToHex(conway),
      ruleset: conway,
    }
  }

  // Use exploration/exploitation strategy for initial offscreen rule
  let offScreenRule = await generateNextRule()

  // Apply URL seed if provided (only on initial load)
  if (urlState.seed !== undefined) {
    onScreenCA.setSeed(urlState.seed)
    console.log('[mobile] Using seed from URL:', urlState.seed)
  }

  // Initial setup with explicit renders
  // Use URL seedPercentage if provided, otherwise default to 50%
  const initialSeedPercentage = urlState.seedPercentage ?? 50
  prepareAutomata(onScreenCA, onScreenRule, lookup, initialSeedPercentage)
  startAutomata(onScreenCA, onScreenRule)

  prepareAutomata(offScreenCA, offScreenRule, lookup)
  offscreenReady = true

  initializeRunStats(onScreenCA, onScreenRule)

  // Set initial header color to match canvas
  updateHeaderColor(palette[colorIndex])

  // Create stats overlay - append to container for proper positioning in mobile preview
  const {
    elements: statsElements,
    show: showStats,
    hide: hideStats,
    update: updateStats,
  } = createStatsOverlay(container)

  const cleanupStatsOverlay = setupStatsOverlay(
    statsElements,
    hideStats,
    () => updateStats(getCurrentRunData()), // refresh every second
  )

  // Audio update loop (10 Hz / every 100ms)
  let audioUpdateInterval: number | null = null
  const startAudioUpdates = () => {
    if (audioUpdateInterval) return
    audioUpdateInterval = window.setInterval(() => {
      if (audioEngine && audioEnabled && audioInitialized) {
        const stats = onScreenCA.getStatistics()
        const recent = stats.getRecentStats(1)[0]
        if (recent) {
          ;(audioEngine as AudioEngine).updateFromStats(recent)
        }
      }
    }, 100) // 10 Hz update rate
  }

  const stopAudioUpdates = () => {
    if (audioUpdateInterval) {
      clearInterval(audioUpdateInterval)
      audioUpdateInterval = null
    }
  }

  // Start audio updates if audio is enabled
  if (audioEnabled) {
    startAudioUpdates()
  }

  // Helper function to get current run data
  const getCurrentRunData = (): RunSubmission => {
    const stats = onScreenCA.getStatistics()
    const { metadata, recent } = getRunStatsSnapshot(onScreenCA)

    return {
      userId: getUserIdentity().userId,
      userLabel: getUserIdentity().userLabel,
      rulesetName: onScreenRule.name,
      rulesetHex: onScreenRule.hex,
      seed: onScreenCA.getSeed(),
      seedType: (metadata?.seedType ?? 'patch') as
        | 'center'
        | 'random'
        | 'patch',
      seedPercentage: metadata?.seedPercentage ?? 50,
      stepCount: metadata?.stepCount ?? 0,
      watchedSteps: metadata?.stepCount ?? 0,
      watchedWallMs: stats.getElapsedTime(),
      gridSize: onScreenCA.getGridSize(),
      progress_bar_steps: undefined,
      requestedSps: metadata?.requestedStepsPerSecond ?? STEPS_PER_SECOND,
      actualSps: stats.getActualStepsPerSecond(),
      population: recent.population,
      activity: recent.activity,
      populationChange: recent.populationChange,
      entropy2x2: recent.entropy2x2,
      entropy4x4: recent.entropy4x4,
      entropy8x8: recent.entropy8x8,
      entityCount: recent.entityCount,
      entityChange: recent.entityChange,
      totalEntitiesEverSeen: recent.totalEntitiesEverSeen,
      uniquePatterns: recent.uniquePatterns,
      entitiesAlive: recent.entitiesAlive,
      entitiesDied: recent.entitiesDied,
      interestScore: stats.calculateInterestScore(),
      simVersion: 'v0.1.0',
      engineCommit: undefined,
      extraScores: undefined,
    }
  }

  // Track starred status (resets to false after each swipe)
  let currentIsStarred = false

  // Create control buttons with auto-fade container
  const {
    container: controlContainer,
    resetFade: resetControlFade,
    cleanup: cleanupControlContainer,
  } = createAutoFadeContainer({
    position: { bottom: '16px', right: '16px' },
    fadeAfterMs: 3000,
    fadedOpacity: 0.3,
    className: 'flex flex-row-reverse space-x-reverse space-x-2',
  })

  // Closure variable to store hash for the currently visible rule
  // Using a closure variable instead of per-object storage because rule objects
  // are discarded after being swapped out (not reused in the dual-canvas architecture)
  let currentlyVisibleRuleHash: string | undefined = undefined

  let shareBtn = createShareButton(
    resetControlFade,
    () => ({ ca: onScreenCA, rule: onScreenRule, isStarred: currentIsStarred }),
    () => currentlyVisibleRuleHash,
    (hash) => {
      currentlyVisibleRuleHash = hash
    },
    saveRunStatistics,
    () => isTransitioning,
  )
  let statsBtn = createStatsButton(
    () => showStats(getCurrentRunData()),
    resetControlFade,
    () => ({ ca: onScreenCA, rule: onScreenRule, isStarred: currentIsStarred }),
    () => currentlyVisibleRuleHash,
    (hash) => {
      currentlyVisibleRuleHash = hash
    },
    saveRunStatistics,
    () => isTransitioning,
  )
  let starBtn = createStarButton({
    getIsStarred: () => currentIsStarred,
    onToggle: (isStarred) => {
      currentIsStarred = isStarred
    },
    onResetFade: resetControlFade,
    isTransitioning: () => isTransitioning,
  })
  let softResetButton = createSoftResetButton(
    () => {
      softResetAutomata(onScreenCA)
      startAutomata(onScreenCA, onScreenRule)
    },
    resetControlFade,
    () => isTransitioning,
  )

  // Wire up died-out callback to pulse reset button
  onDiedOutCallback = () => {
    softResetButton.startPulse()
  }

  controlContainer.appendChild(softResetButton.button)
  controlContainer.appendChild(starBtn.button)
  controlContainer.appendChild(statsBtn.button)
  controlContainer.appendChild(shareBtn.button)
  wrapper.appendChild(controlContainer)
  resetControlFade()

  let hasSwipedOnce = false
  const cleanupSwipe = setupDualCanvasSwipe(
    wrapper,
    onScreenCanvas,
    offScreenCanvas,
    // --- onCommit: Called AFTER animation, swaps and prepares for next -------
    () => {
      offscreenReady = false

      if (!hasSwipedOnce) {
        hasSwipedOnce = true
        instruction.style.opacity = '0'
        setTimeout(() => instruction.remove(), 300)
      }

      // Note: We save statistics on-demand when user clicks Share/Stats buttons
      // This ensures hash is always available for the currently visible rule

      // Reset starred status for next simulation
      currentIsStarred = false

      // Swap references: incoming becomes onScreen, outgoing becomes offScreen
      ;[onScreenCanvas, offScreenCanvas] = [offScreenCanvas, onScreenCanvas]
      ;[onScreenCA, offScreenCA] = [offScreenCA, onScreenCA]
      ;[onScreenRule, offScreenRule] = [offScreenRule, onScreenRule]

      // Clear hash for newly visible rule (will be set when save completes)
      currentlyVisibleRuleHash = undefined
      console.log(
        `[tracking] Hash cleared for newly visible rule: ${onScreenRule.name}`,
      )

      // Update z-index and positioning explicitly
      const h = onScreenCanvas.height
      onScreenCanvas.style.zIndex = '1' // Behind buttons (z-10)
      onScreenCanvas.style.pointerEvents = 'none' // Let events fall through to wrapper
      onScreenCanvas.style.transform = 'translateY(0)'

      offScreenCanvas.style.zIndex = '1' // Same level
      offScreenCanvas.style.pointerEvents = 'none'
      offScreenCanvas.style.transform = `translateY(${h}px)`

      // Update colors (no auto-render with refactored CA)
      colorIndex = (colorIndex + 1) % palette.length
      const col = palette[colorIndex]
      const nextCol = palette[(colorIndex + 1) % palette.length]
      onScreenCA.setColors(col, bgColor)
      offScreenCA.setColors(nextCol, bgColor)

      // Update header color to match new canvas color
      updateHeaderColor(col)

      // Defer CA operations by one frame to let layout settle
      setTimeout(async () => {
        initializeRunStats(onScreenCA, onScreenRule)

        // Start the newly visible CA and render
        startAutomata(onScreenCA, onScreenRule)

        // Prepare offscreen CA for the next swipe with explicit render
        // Use exploration/exploitation strategy (80% random, 20% starred)
        offScreenRule = await generateNextRule()
        prepareAutomata(offScreenCA, offScreenRule, lookup, 50)
        offscreenReady = true

        // Update URL to match current simulation state
        updateURLWithoutReload({
          rulesetHex: onScreenRule.hex,
          seed: onScreenCA.getSeed(),
          seedType: 'patch',
          seedPercentage: 50,
        })
      }, 16)

      // Recreate buttons after swipe
      shareBtn.cleanup()
      softResetButton.cleanup()
      starBtn.cleanup()
      statsBtn.cleanup()

      shareBtn = createShareButton(
        resetControlFade,
        () => ({
          ca: onScreenCA,
          rule: onScreenRule,
          isStarred: currentIsStarred,
        }),
        () => currentlyVisibleRuleHash,
        (hash) => {
          currentlyVisibleRuleHash = hash
        },
        saveRunStatistics,
        () => isTransitioning,
      )
      statsBtn = createStatsButton(
        () => showStats(getCurrentRunData()),
        resetControlFade,
        () => ({
          ca: onScreenCA,
          rule: onScreenRule,
          isStarred: currentIsStarred,
        }),
        () => currentlyVisibleRuleHash,
        (hash) => {
          currentlyVisibleRuleHash = hash
        },
        saveRunStatistics,
        () => isTransitioning,
      )
      starBtn = createStarButton({
        getIsStarred: () => currentIsStarred,
        onToggle: (isStarred) => {
          currentIsStarred = isStarred
        },
        onResetFade: resetControlFade,
        isTransitioning: () => isTransitioning,
      })
      softResetButton = createSoftResetButton(
        () => {
          softResetAutomata(onScreenCA)
          startAutomata(onScreenCA, onScreenRule)
        },
        resetControlFade,
        () => isTransitioning,
      )

      controlContainer.innerHTML = ''
      controlContainer.appendChild(softResetButton.button)
      controlContainer.appendChild(starBtn.button)
      controlContainer.appendChild(statsBtn.button)
      controlContainer.appendChild(shareBtn.button)
      resetControlFade()

      console.log(`Switched to: ${onScreenRule.name}`)
    },
    // --- onCancel: Resume playing onScreen CA if user cancels swipe ----------
    () => onScreenCA.play(STEPS_PER_SECOND),
    // --- onDragStart: Pause onScreen CA so both canvases are static ----------
    () => onScreenCA.pause(),
  )

  const handleResize = () => {
    if (isTransitioning) return

    const { gridCols, gridRows, cellSize, screenWidth, screenHeight } =
      computeAdaptiveGrid(TARGET_GRID_SIZE, appRoot)

    wrapper.style.width = `${screenWidth}px`
    wrapper.style.height = `${screenHeight}px`

    for (const canvas of [onScreenCanvas, offScreenCanvas]) {
      canvas.width = screenWidth
      canvas.height = screenHeight
      canvas.style.width = `${screenWidth}px`
      canvas.style.height = `${screenHeight}px`
    }

    onScreenCA.pause()
    offScreenCA.pause()
    onScreenCA.resize(gridRows, gridCols)
    offScreenCA.resize(gridRows, gridCols)

    const h = wrapper.clientHeight
    onScreenCanvas.style.transform = 'translateY(0)'
    offScreenCanvas.style.transform = `translateY(${h}px)`

    console.log(`[resize] ${gridCols}×${gridRows} @ cellSize=${cellSize}px`)
  }

  let resizeTimer: number | null = null
  window.addEventListener('resize', () => {
    if (isTransitioning) return
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(handleResize, 120)
  })

  const cleanupZoomButtons = createZoomButtons(wrapper, () => [
    onScreenCA,
    offScreenCA,
  ])

  return () => {
    onScreenCA.pause()
    offScreenCA.pause()
    cleanupSwipe()
    cleanupZoomButtons()
    cleanupControlContainer()
    cleanupHeader()
    cleanupStatsOverlay()
    stopAudioUpdates()
    if (audioEngine) {
      ;(audioEngine as AudioEngine).stop()
    }
    window.removeEventListener('resize', handleResize)
  }
}
