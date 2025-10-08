// src/components/mobile.ts
import { saveRun } from '../api/save'
import { CellularAutomata } from '../cellular-automata.ts'
import { getUserIdentity } from '../identity.ts'
import type { C4OrbitsData, Ruleset, RunSubmission } from '../schema.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  expandC4Ruleset,
  makeC4Ruleset,
  randomC4RulesetByDensity,
} from '../utils.ts'

import { createMobileHeader, setupMobileHeader } from './mobileHeader.ts'

// --- Feature Flags ----------------------------------------------------------
const ENABLE_ZOOM_AND_PAN = false

// --- Constants --------------------------------------------------------------
const FORCE_RULE_ZERO_OFF = true // avoid strobing
const STEPS_PER_SECOND = 100
const TARGET_GRID_SIZE = 500_000

const SWIPE_COMMIT_THRESHOLD_PERCENT = 0.1
const SWIPE_COMMIT_MIN_DISTANCE = 50
const SWIPE_VELOCITY_THRESHOLD = -0.3
const SWIPE_FAST_THROW_THRESHOLD = -0.5
const SWIPE_COOLDOWN_MS = 500

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

// --- Types ------------------------------------------------------------------
export type CleanupFunction = () => void

interface RuleData {
  name: string
  hex: string
  ruleset: Ruleset
}

// --- Helpers ----------------------------------------------------------------
function computeAdaptiveGrid(maxCells = TARGET_GRID_SIZE) {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

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
  return { gridCols, gridRows, cellSize, totalCells, screenWidth, screenHeight }
}

// --- Promise helper ---------------------------------------------------------
function waitForTransitionEnd(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const done = (ev: TransitionEvent) => {
      if (ev.propertyName === 'transform') {
        el.removeEventListener('transitionend', done)
        resolve()
      }
    }
    el.addEventListener('transitionend', done)
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
function setupDualCanvasSwipe(
  wrapper: HTMLElement,
  outgoingCanvas: HTMLCanvasElement,
  incomingCanvas: HTMLCanvasElement,
  onCommit: () => void,
  onCancel: () => void,
  onDragStart?: () => void,
): CleanupFunction {
  let startY = 0
  let currentY = 0
  let startT = 0
  let dragging = false
  let directionLocked: 'up' | 'down' | null = null
  let lastSwipeTime = 0
  const samples: { t: number; y: number }[] = []
  const getHeight = () => wrapper.clientHeight

  const resetTransforms = (h: number) => {
    outgoingCanvas.style.transform = 'translateY(0)'
    incomingCanvas.style.transform = `translateY(${h}px)`
    outgoingCanvas.style.opacity = '1'
    incomingCanvas.style.opacity = '1'
  }

  const handleTouchStart = (e: TouchEvent) => {
    const target = e.target as HTMLElement | null
    if (
      target?.closest(
        '[data-swipe-ignore="true"], button, a, input, select, textarea',
      )
    ) {
      return
    }

    if (e.touches.length !== 1) return
    const now = performance.now()
    if (now - lastSwipeTime < SWIPE_COOLDOWN_MS) return
    if (isTransitioning) return

    startY = e.touches[0].clientY
    currentY = startY
    startT = e.timeStamp
    directionLocked = null
    dragging = true
    samples.length = 0
    samples.push({ t: startT, y: startY })

    wrapper.style.transition = 'none'
    outgoingCanvas.style.transition = 'none'
    incomingCanvas.style.transition = 'none'
    onDragStart?.()
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    const y = e.touches[0].clientY
    const dy = y - startY
    const absDy = Math.abs(dy)

    // Lock direction with a little hysteresis
    if (!directionLocked && absDy > 8) directionLocked = dy < 0 ? 'up' : 'down'

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
    const progress = Math.abs(delta) / height

    outgoingCanvas.style.transform = `translateY(${delta}px)`
    incomingCanvas.style.transform = `translateY(${height + delta}px)`
    outgoingCanvas.style.opacity = `${Math.max(0.3, 1 - progress * 0.7)}`
    incomingCanvas.style.opacity = `${Math.min(1, 0.3 + progress * 0.7)}`
  }

  const doCancel = async () => {
    const height = getHeight()
    const duration = 0.25
    const transition = `transform ${duration}s cubic-bezier(0.4,0,0.2,1), opacity ${duration}s ease`
    outgoingCanvas.style.transition = transition
    incomingCanvas.style.transition = transition

    outgoingCanvas.style.transform = 'translateY(0)'
    incomingCanvas.style.transform = `translateY(${height}px)`
    outgoingCanvas.style.opacity = '1'
    incomingCanvas.style.opacity = '1'

    await Promise.all([
      waitForTransitionEnd(outgoingCanvas),
      waitForTransitionEnd(incomingCanvas),
    ])
    outgoingCanvas.style.transition = 'none'
    incomingCanvas.style.transition = 'none'
    onCancel()
  }

  const handleTouchEndCore = async (forceCancel = false) => {
    const wasDragging = dragging
    const lockedDirection = directionLocked
    dragging = false
    lastSwipeTime = performance.now()

    if (!wasDragging || forceCancel || lockedDirection === 'down') {
      await doCancel()
      return
    }

    const height = getHeight()
    const delta = currentY - startY
    const dragDistance = Math.abs(delta)

    // compute velocity
    let vy = 0
    if (samples.length >= 2) {
      const a = samples[0]
      const b = samples[samples.length - 1]
      const dt = Math.max(1, b.t - a.t)
      vy = (b.y - a.y) / dt
    }

    const tinyAccidentalMove = dragDistance < 15
    const slowPullback = delta > 0
    const fastFlick = vy < SWIPE_FAST_THROW_THRESHOLD
    const normalFlick =
      dragDistance > height * SWIPE_COMMIT_THRESHOLD_PERCENT ||
      (dragDistance > SWIPE_COMMIT_MIN_DISTANCE &&
        vy < SWIPE_VELOCITY_THRESHOLD)
    const shouldCommit =
      !tinyAccidentalMove && !slowPullback && (fastFlick || normalFlick)

    const duration = shouldCommit ? 0.35 : 0.25
    const transition = `transform ${duration}s cubic-bezier(0.4,0,0.2,1), opacity ${duration}s ease`
    outgoingCanvas.style.transition = transition
    incomingCanvas.style.transition = transition
    void outgoingCanvas.offsetWidth

    isTransitioning = true

    if (shouldCommit) {
      // Ensure outgoing CA is paused
      onCancel()

      // Animate both canvases (both already showing their correct content)
      outgoingCanvas.style.transform = `translateY(-${height}px)`
      incomingCanvas.style.transform = 'translateY(0)'
      outgoingCanvas.style.opacity = '0'
      incomingCanvas.style.opacity = '1'

      await Promise.all([
        waitForTransitionEnd(outgoingCanvas),
        waitForTransitionEnd(incomingCanvas),
      ])

      // Reset transitions and ensure transforms are set before swapping
      outgoingCanvas.style.transition = 'none'
      incomingCanvas.style.transition = 'none'
      outgoingCanvas.style.transform = `translateY(-${height}px)`
      incomingCanvas.style.transform = 'translateY(0)'
      outgoingCanvas.style.opacity = '0'
      incomingCanvas.style.opacity = '1'

      // Ensure incoming canvas is visible
      incomingCanvas.style.visibility = 'visible'

      // Delay onCommit by one frame to let browser finish compositing
      requestAnimationFrame(() => onCommit())
    } else {
      await doCancel()
    }

    isTransitioning = false
  }

  const handleTouchEnd = (_: TouchEvent) => {
    void handleTouchEndCore(false)
  }
  const handleTouchCancel = (_: TouchEvent) => {
    void handleTouchEndCore(true)
  }

  wrapper.addEventListener('touchstart', handleTouchStart, { passive: true })
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: true })
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: true })
  wrapper.addEventListener('touchcancel', handleTouchCancel, { passive: true })

  return () => {
    wrapper.removeEventListener('touchstart', handleTouchStart)
    wrapper.removeEventListener('touchmove', handleTouchMove)
    wrapper.removeEventListener('touchend', handleTouchEnd)
    wrapper.removeEventListener('touchcancel', handleTouchCancel)
  }
}

// --- Pinch Zoom & Pan (centered on midpoint) -------------------------------
function setupPinchZoomAndPan(
  canvas: HTMLCanvasElement,
  cellularAutomata: CellularAutomata,
): CleanupFunction {
  let initialDistance = 0
  let initialZoom = 1
  let zoomCenterX = 0
  let zoomCenterY = 0

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      initialDistance = Math.sqrt(dx * dx + dy * dy)
      initialZoom = cellularAutomata.getZoom()

      // Calculate midpoint in canvas coordinates
      const rect = canvas.getBoundingClientRect()
      zoomCenterX =
        ((t1.clientX + t2.clientX) / 2 - rect.left) *
        (canvas.width / rect.width)
      zoomCenterY =
        ((t1.clientY + t2.clientY) / 2 - rect.top) *
        (canvas.height / rect.height)
    }
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const [t1, t2] = e.touches
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (!initialDistance) return
      const scaleChange = distance / initialDistance
      const newZoom = initialZoom * scaleChange

      // Zoom centered on the midpoint
      cellularAutomata.setZoomCentered(newZoom, zoomCenterX, zoomCenterY)
    }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2) initialDistance = 0
  }

  canvas.addEventListener('touchstart', handleTouchStart, { passive: true })
  canvas.addEventListener('touchmove', handleTouchMove, { passive: false })
  canvas.addEventListener('touchend', handleTouchEnd, { passive: true })
  canvas.addEventListener('touchcancel', handleTouchEnd, { passive: true })

  return () => {
    canvas.removeEventListener('touchstart', handleTouchStart)
    canvas.removeEventListener('touchmove', handleTouchMove)
    canvas.removeEventListener('touchend', handleTouchEnd)
    canvas.removeEventListener('touchcancel', handleTouchEnd)
  }
}

// --- Helper: Rule generation and loading ------------------------------------
function generateRandomRule(): RuleData {
  const density = Math.random() * 0.6 + 0.2
  const ruleset = randomC4RulesetByDensity(density, FORCE_RULE_ZERO_OFF)
  return {
    name: `Random (${Math.round(density * 100)}%)`,
    hex: c4RulesetToHex(ruleset),
    ruleset,
  }
}

function loadRule(
  cellularAutomata: CellularAutomata,
  rule: RuleData,
  orbitLookup: Uint8Array,
  seedPercentage = 50,
  startPlaying = true,
): void {
  cellularAutomata.pause()
  cellularAutomata.patchSeed(seedPercentage)
  const expanded = expandC4Ruleset(rule.ruleset, orbitLookup)
  cellularAutomata.render()

  if (startPlaying) {
    cellularAutomata.play(STEPS_PER_SECOND, expanded)
  }
}

// --- Save run ---------------------------------------------------------------
function saveRunStatistics(
  cellularAutomata: CellularAutomata,
  ruleName: string,
  ruleHex: string,
): void {
  const stats = cellularAutomata.getStatistics()
  const metadata = stats.getMetadata()
  const recent = stats.getRecentStats(1)[0] ?? {
    population: 0,
    activity: 0,
    populationChange: 0,
    entropy2x2: 0,
    entropy4x4: 0,
    entropy8x8: 0,
  }

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
    interestScore: stats.calculateInterestScore(),
    simVersion: 'v0.1.0',
    engineCommit: undefined,
    extraScores: undefined,
  }

  setTimeout(
    () =>
      saveRun(payload).then((r) =>
        r.ok
          ? console.log(`[saveRun] ✅ ${r.runHash}`)
          : console.warn('[saveRun] ❌ failed'),
      ),
    0,
  )
}

// --- Reload Button ----------------------------------------------------------
function createReloadButton(
  parent: HTMLElement,
  onReload: () => void,
  visibleCanvas: HTMLCanvasElement,
  hiddenCanvas: HTMLCanvasElement,
) {
  const btn = document.createElement('button')
  btn.setAttribute('data-swipe-ignore', 'true')
  btn.style.touchAction = 'manipulation' // avoids 300ms delay on iOS

  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="currentColor" class="w-6 h-6">
      <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>
    </svg>`
  btn.className =
    'absolute bottom-4 right-4 p-3 rounded-full bg-gray-800 text-white shadow-md hover:bg-gray-700 transition z-10'
  btn.title = 'Reload simulation'

  // Swallow events so they don't reach the wrapper
  const swallow = (e: Event) => e.stopPropagation()
  btn.addEventListener('pointerdown', swallow)
  btn.addEventListener('pointerup', swallow)
  btn.addEventListener('mousedown', swallow)
  btn.addEventListener('mouseup', swallow)
  btn.addEventListener('touchstart', swallow, { passive: true })
  btn.addEventListener('touchmove', swallow, { passive: true })
  btn.addEventListener('touchend', swallow, { passive: true })
  btn.addEventListener('touchcancel', swallow, { passive: true })

  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (isTransitioning) return
    isTransitioning = true

    onReload()

    // Hide the off-screen canvas during animation to prevent visual glitches
    const prevVis = hiddenCanvas.style.visibility
    hiddenCanvas.style.visibility = 'hidden'

    const cleanup = () => {
      visibleCanvas.style.transition = ''
      visibleCanvas.removeEventListener('transitionend', cleanup)
      hiddenCanvas.style.visibility = prevVis || ''
      isTransitioning = false
    }

    visibleCanvas.addEventListener('transitionend', cleanup)
    void visibleCanvas.offsetWidth // force layout
    visibleCanvas.style.transition = 'transform 0.15s ease'
    visibleCanvas.style.transform = 'scale(0.96)'
    setTimeout(() => {
      visibleCanvas.style.transform = 'scale(1)'
    }, 15)
  })

  parent.appendChild(btn)
  return btn
}

// --- Main -------------------------------------------------------------------
export async function setupMobileLayout(
  appRoot: HTMLDivElement,
): Promise<CleanupFunction> {
  const container = document.createElement('div')
  container.className =
    'fixed inset-0 flex flex-col items-center justify-center bg-white dark:bg-gray-900 overflow-hidden'

  const { root: headerRoot, elements: headerElements } = createMobileHeader()
  const cleanupHeader = setupMobileHeader(headerElements)
  container.appendChild(headerRoot)

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const palette = isDark ? DARK_FG_COLORS : LIGHT_FG_COLORS
  const bgColor = isDark ? '#1e1e1e' : '#ffffff'
  let colorIndex = Math.floor(Math.random() * palette.length)

  const size = Math.min(window.innerWidth, window.innerHeight)
  const wrapper = document.createElement('div')
  wrapper.className = 'relative overflow-hidden'
  wrapper.style.width = `${size}px`
  wrapper.style.height = `${size}px`

  // Create both canvases with semantic initial roles
  const createCanvas = () => {
    const c = document.createElement('canvas')
    c.width = size
    c.height = size
    c.className = 'absolute inset-0 rounded-lg touch-none'
    c.style.width = `${size}px`
    c.style.height = `${size}px`
    c.style.willChange = 'transform, opacity'
    return c
  }

  let onScreenCanvas = createCanvas()
  let offScreenCanvas = createCanvas()

  onScreenCanvas.style.zIndex = '2'
  onScreenCanvas.style.pointerEvents = 'auto'
  onScreenCanvas.style.visibility = 'visible'

  offScreenCanvas.style.zIndex = '1'
  offScreenCanvas.style.pointerEvents = 'none'
  offScreenCanvas.style.transform = `translateY(${size}px)`
  offScreenCanvas.style.visibility = 'visible'

  wrapper.appendChild(onScreenCanvas)
  wrapper.appendChild(offScreenCanvas)
  container.appendChild(wrapper)

  // Instruction
  const instruction = document.createElement('div')
  instruction.className =
    'fixed bottom-8 left-0 right-0 text-center text-gray-500 dark:text-gray-400 text-sm pointer-events-none transition-opacity duration-300'
  instruction.style.opacity = '0.7'
  instruction.style.zIndex = '1000'
  instruction.style.transition = 'opacity 0.6s ease'
  instruction.innerHTML = `<div class="flex flex-col items-center gap-2">
      <svg class="w-6 h-6 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/>
      </svg><span>Swipe up for new rule</span></div>`
  container.appendChild(instruction)
  appRoot.appendChild(container)

  const res = await fetch('./resources/c4-orbits.json')
  const orbits: C4OrbitsData = await res.json()
  const lookup = buildOrbitLookup(orbits)

  const {
    gridCols,
    gridRows,
    cellSize,
    totalCells,
    screenWidth,
    screenHeight,
  } = computeAdaptiveGrid()

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

  // Create cellular automata instances
  let onScreenCA = new CellularAutomata(onScreenCanvas, {
    gridRows,
    gridCols,
    fgColor: palette[colorIndex],
    bgColor,
  })
  let offScreenCA = new CellularAutomata(offScreenCanvas, {
    gridRows,
    gridCols,
    fgColor: palette[(colorIndex + 1) % palette.length],
    bgColor,
  })

  const conway = makeC4Ruleset(conwayRule, lookup)
  let onScreenRule: RuleData = {
    name: "Conway's Game of Life",
    hex: c4RulesetToHex(conway),
    ruleset: conway,
  }
  let offScreenRule = generateRandomRule()

  // Load and start the onScreen CA
  loadRule(onScreenCA, onScreenRule, lookup)

  // Pre-load the offScreen CA with the next rule (paused, ready for first swap)
  loadRule(offScreenCA, offScreenRule, lookup)
  offScreenCA.pause()

  onScreenCA.getStatistics().initializeSimulation({
    name: `Mobile - ${onScreenRule.name}`,
    seedType: 'patch',
    seedPercentage: 50,
    rulesetName: onScreenRule.name,
    rulesetHex: onScreenRule.hex,
    startTime: Date.now(),
    requestedStepsPerSecond: STEPS_PER_SECOND,
  })

  let reload = createReloadButton(
    wrapper,
    () => loadRule(onScreenCA, onScreenRule, lookup),
    onScreenCanvas,
    offScreenCanvas,
  )

  let hasSwipedOnce = false
  const cleanupSwipe = setupDualCanvasSwipe(
    wrapper,
    onScreenCanvas,
    offScreenCanvas,
    // --- onCommit: Called AFTER animation, swaps and prepares for next -------
    () => {
      if (!hasSwipedOnce) {
        hasSwipedOnce = true
        instruction.style.opacity = '0'
        setTimeout(() => instruction.remove(), 300)
      }
      saveRunStatistics(onScreenCA, onScreenRule.name, onScreenRule.hex)

      // Swap references: incoming becomes onScreen, outgoing becomes offScreen
      ;[onScreenCanvas, offScreenCanvas] = [offScreenCanvas, onScreenCanvas]
      ;[onScreenCA, offScreenCA] = [offScreenCA, onScreenCA]
      ;[onScreenRule, offScreenRule] = [offScreenRule, onScreenRule]

      // Hide offScreen canvas immediately, then restore visibility
      offScreenCanvas.style.visibility = 'hidden'
      requestAnimationFrame(() => {
        offScreenCanvas.style.visibility = 'visible'
      })

      // Update z-index and positioning explicitly
      const h = onScreenCanvas.height
      onScreenCanvas.style.zIndex = '2'
      onScreenCanvas.style.pointerEvents = 'auto'
      onScreenCanvas.style.transform = 'translateY(0)'
      onScreenCanvas.style.opacity = '1'

      offScreenCanvas.style.zIndex = '1'
      offScreenCanvas.style.pointerEvents = 'none'
      offScreenCanvas.style.transform = `translateY(${h}px)`
      offScreenCanvas.style.opacity = '1'

      // Update colors
      colorIndex = (colorIndex + 1) % palette.length
      const col = palette[colorIndex]
      const nextCol = palette[(colorIndex + 1) % palette.length]
      onScreenCA.setColors(col, bgColor)
      offScreenCA.setColors(nextCol, bgColor)

      // Defer CA operations by one frame to let layout settle
      setTimeout(() => {
        // Start playing the new onScreen CA
        onScreenCA.play(STEPS_PER_SECOND, onScreenRule.ruleset)

        // Prepare offScreen canvas for NEXT swap
        offScreenCA.pause()
        offScreenCA.resetZoom()
        offScreenRule = generateRandomRule()
        loadRule(offScreenCA, offScreenRule, lookup, 50, false)
      }, 16)

      // Recreate reload button with updated canvas references
      reload.remove()
      reload = createReloadButton(
        wrapper,
        () => loadRule(onScreenCA, onScreenRule, lookup),
        onScreenCanvas,
        offScreenCanvas,
      )

      console.log(`Switched to: ${onScreenRule.name}`)
    },
    // --- onCancel: Resume playing onScreen CA if user cancels swipe ----------
    () => onScreenCA.play(STEPS_PER_SECOND, onScreenRule.ruleset),
    // --- onDragStart: Pause onScreen CA so both canvases are static ----------
    () => onScreenCA.pause(),
  )

  // Conditionally setup zoom and pan based on feature flag
  let cleanupZoomOnScreen: CleanupFunction = () => {}
  let cleanupZoomOffScreen: CleanupFunction = () => {}

  if (ENABLE_ZOOM_AND_PAN) {
    cleanupZoomOnScreen = setupPinchZoomAndPan(onScreenCanvas, onScreenCA)
    cleanupZoomOffScreen = setupPinchZoomAndPan(offScreenCanvas, offScreenCA)
  }

  const handleResize = () => {
    if (isTransitioning) return

    const { gridCols, gridRows, cellSize, screenWidth, screenHeight } =
      computeAdaptiveGrid()

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

  return () => {
    onScreenCA.pause()
    offScreenCA.pause()
    cleanupSwipe()
    cleanupZoomOnScreen()
    cleanupZoomOffScreen()
    cleanupHeader()
    window.removeEventListener('resize', handleResize)
  }
}
