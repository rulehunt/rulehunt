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

// --- Constants --------------------------------------------------------------
const FORCE_RULE_ZERO_OFF = true // avoid strobing
const STEPS_PER_SECOND = 10

const SWIPE_COMMIT_THRESHOLD_PERCENT = 0.15
const SWIPE_COMMIT_MIN_DISTANCE = 40
const SWIPE_VELOCITY_THRESHOLD = -0.25
const SWIPE_FAST_THROW_THRESHOLD = -0.4

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

/**
 * Compute grid dimensions and cell size to fit the current screen,
 * keeping total cells ≤ maxCells.
 */
function computeAdaptiveGrid(maxCells = 100_000) {
  const screenWidth = window.innerWidth
  const screenHeight = window.innerHeight

  let cellSize = 1
  let gridCols = screenWidth
  let gridRows = screenHeight
  let totalCells = gridCols * gridRows

  // Increase cell size until total cells ≤ maxCells
  while (totalCells > maxCells) {
    cellSize += 1
    gridCols = Math.floor(screenWidth / cellSize)
    gridRows = Math.floor(screenHeight / cellSize)
    totalCells = gridCols * gridRows
  }

  return { gridCols, gridRows, cellSize, totalCells, screenWidth, screenHeight }
}

// --- Dual-Canvas Swipe Handler ----------------------------------------------

function setupDualCanvasSwipe(
  wrapper: HTMLElement,
  canvasA: HTMLCanvasElement,
  canvasB: HTMLCanvasElement,
  onCommit: () => void,
  onCancel: () => void,
  onDragStart?: () => void,
): CleanupFunction {
  let startY = 0
  let currentY = 0
  let startT = 0
  let dragging = false
  let directionLocked: 'up' | 'down' | null = null
  const samples: { t: number; y: number }[] = []

  const getHeight = () => wrapper.clientHeight

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length !== 1) return
    startY = e.touches[0].clientY
    currentY = startY
    startT = e.timeStamp
    directionLocked = null
    dragging = true
    samples.length = 0
    samples.push({ t: startT, y: startY })

    wrapper.style.transition = 'none'
    canvasA.style.transition = 'none'
    canvasB.style.transition = 'none'
    onDragStart?.()
  }

  const handleTouchMove = (e: TouchEvent) => {
    if (!dragging || e.touches.length !== 1) return
    const y = e.touches[0].clientY
    const dy = y - startY
    const absDy = Math.abs(dy)

    // Direction lock (after 8px movement)
    if (!directionLocked && absDy > 8) {
      directionLocked = dy < 0 ? 'up' : 'down'
    }

    // Ignore downward motion
    if (directionLocked === 'down') {
      dragging = false
      canvasA.style.transform = 'translateY(0)'
      canvasB.style.transform = `translateY(${getHeight()}px)`
      canvasA.style.opacity = '1'
      canvasB.style.opacity = '1'
      return
    }

    currentY = y
    samples.push({ t: e.timeStamp, y })
    const cutoff = e.timeStamp - 100 // 100 ms momentum window
    while (samples.length > 2 && samples[0].t < cutoff) samples.shift()

    const delta = Math.min(0, dy)
    const height = getHeight()
    const progress = Math.abs(delta) / height

    canvasA.style.transform = `translateY(${delta}px)`
    canvasB.style.transform = `translateY(${height + delta}px)`
    canvasA.style.opacity = `${Math.max(0.3, 1 - progress * 0.7)}`
    canvasB.style.opacity = `${Math.min(1, 0.3 + progress * 0.7)}`
  }

  const handleTouchEnd = (_: TouchEvent) => {
    if (!dragging) return
    dragging = false

    const height = getHeight()
    const delta = currentY - startY
    const dragDistance = Math.abs(delta)

    // Compute recent (100 ms) velocity
    let vy = 0
    if (samples.length >= 2) {
      const a = samples[0]
      const b = samples[samples.length - 1]
      const dt = Math.max(1, b.t - a.t)
      vy = (b.y - a.y) / dt // px/ms; negative = upward
    }

    const fastFlick = vy < SWIPE_FAST_THROW_THRESHOLD
    const normalFlick =
      dragDistance > height * SWIPE_COMMIT_THRESHOLD_PERCENT ||
      (dragDistance > SWIPE_COMMIT_MIN_DISTANCE &&
        vy < SWIPE_VELOCITY_THRESHOLD)

    const shouldCommit = fastFlick || normalFlick

    const transitionDuration = shouldCommit ? '0.35s' : '0.25s'
    const transition =
      `transform ${transitionDuration} cubic-bezier(0.4,0,0.2,1), ` +
      `opacity ${transitionDuration} ease`
    canvasA.style.transition = transition
    canvasB.style.transition = transition

    if (shouldCommit) {
      canvasA.style.transform = `translateY(-${height}px)`
      canvasB.style.transform = 'translateY(0)'
      canvasA.style.opacity = '0'
      canvasB.style.opacity = '1'
      setTimeout(onCommit, Number.parseFloat(transitionDuration) * 1000)
    } else {
      canvasA.style.transform = 'translateY(0)'
      canvasB.style.transform = `translateY(${height}px)`
      canvasA.style.opacity = '1'
      canvasB.style.opacity = '1'
      setTimeout(onCancel, Number.parseFloat(transitionDuration) * 1000)
    }
  }

  wrapper.addEventListener('touchstart', handleTouchStart, { passive: true })
  wrapper.addEventListener('touchmove', handleTouchMove, { passive: true })
  wrapper.addEventListener('touchend', handleTouchEnd, { passive: true })
  wrapper.addEventListener('touchcancel', handleTouchEnd, { passive: true })

  return () => {
    wrapper.removeEventListener('touchstart', handleTouchStart)
    wrapper.removeEventListener('touchmove', handleTouchMove)
    wrapper.removeEventListener('touchend', handleTouchEnd)
    wrapper.removeEventListener('touchcancel', handleTouchEnd)
  }
}

// --- Pinch Zoom & Pan -------------------------------------------------------
function setupPinchZoomAndPan(
  canvas: HTMLCanvasElement,
  cellularAutomata: CellularAutomata,
): CleanupFunction {
  let initialDistance = 0
  let initialZoom = 1
  let lastMidX = 0
  let lastMidY = 0
  let initialPanX = 0
  let initialPanY = 0

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      const [t1, t2] = e.touches
      const dx = t1.clientX - t2.clientX
      const dy = t1.clientY - t2.clientY
      initialDistance = Math.sqrt(dx * dx + dy * dy)
      initialZoom = cellularAutomata.getZoom()

      const rect = canvas.getBoundingClientRect()
      lastMidX =
        ((t1.clientX + t2.clientX) / 2 - rect.left) *
        (canvas.width / rect.width)
      lastMidY =
        ((t1.clientY + t2.clientY) / 2 - rect.top) *
        (canvas.height / rect.height)
      const pan = cellularAutomata.getPan()
      initialPanX = pan.x
      initialPanY = pan.y
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

      const rect = canvas.getBoundingClientRect()
      const midX =
        ((t1.clientX + t2.clientX) / 2 - rect.left) *
        (canvas.width / rect.width)
      const midY =
        ((t1.clientY + t2.clientY) / 2 - rect.top) *
        (canvas.height / rect.height)
      const deltaX = midX - lastMidX
      const deltaY = midY - lastMidY

      cellularAutomata.setZoomAndPan(
        newZoom,
        midX,
        midY,
        initialPanX + deltaX,
        initialPanY + deltaY,
      )
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
): void {
  cellularAutomata.pause()
  cellularAutomata.patchSeed(seedPercentage)
  const expanded = expandC4Ruleset(rule.ruleset, orbitLookup)
  cellularAutomata.play(STEPS_PER_SECOND, expanded)
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
function createReloadButton(parent: HTMLElement, onReload: () => void) {
  const btn = document.createElement('button')
  btn.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="currentColor" class="w-6 h-6">
      <path d="M12 5V2L8 6l4 4V7a5 5 0 1 1-5 5H5a7 7 0 1 0 7-7z"/>
    </svg>`
  btn.className =
    'absolute bottom-4 right-4 p-3 rounded-full bg-gray-800 text-white shadow-md hover:bg-gray-700 transition z-10'
  btn.title = 'Reload simulation'
  btn.onclick = () => {
    onReload()
    btn.style.transition = 'transform 0.4s ease'
    btn.style.transform = 'rotate(360deg)'
    setTimeout(() => {
      btn.style.transform = ''
    }, 400)
  }
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

  let canvasA = document.createElement('canvas')
  let canvasB = document.createElement('canvas')
  for (const c of [canvasA, canvasB]) {
    c.width = size
    c.height = size
    c.className = 'absolute inset-0 rounded-lg touch-none'
    // Set CSS dimensions to match buffer size
    c.style.width = `${size}px`
    c.style.height = `${size}px`
  }
  canvasA.style.zIndex = '2'
  canvasB.style.zIndex = '1'
  canvasB.style.transform = `translateY(${size}px)`
  canvasB.style.pointerEvents = 'none'
  wrapper.appendChild(canvasA)
  wrapper.appendChild(canvasB)

  container.appendChild(wrapper)

  // Instruction
  const instruction = document.createElement('div')
  instruction.className =
    'fixed bottom-8 left-0 right-0 text-center text-gray-500 dark:text-gray-400 text-sm pointer-events-none transition-opacity duration-300'
  instruction.style.opacity = '0.7'
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
  for (const c of [canvasA, canvasB]) {
    c.width = screenWidth
    c.height = screenHeight
    c.style.width = `${screenWidth}px`
    c.style.height = `${screenHeight}px`
  }

  let currentCA = new CellularAutomata(canvasA, {
    gridRows,
    gridCols,
    fgColor: palette[colorIndex],
    bgColor,
  })
  let nextCA = new CellularAutomata(canvasB, {
    gridRows,
    gridCols,
    fgColor: palette[(colorIndex + 1) % palette.length],
    bgColor,
  })

  const conway = makeC4Ruleset(conwayRule, lookup)
  let currentRule: RuleData = {
    name: "Conway's Game of Life",
    hex: c4RulesetToHex(conway),
    ruleset: conway,
  }
  let nextRule = generateRandomRule()

  loadRule(currentCA, currentRule, lookup)
  loadRule(nextCA, nextRule, lookup)

  currentCA.getStatistics().initializeSimulation({
    name: `Mobile - ${currentRule.name}`,
    seedType: 'patch',
    seedPercentage: 50,
    rulesetName: currentRule.name,
    rulesetHex: currentRule.hex,
    startTime: Date.now(),
    requestedStepsPerSecond: STEPS_PER_SECOND,
  })

  let reload = createReloadButton(wrapper, () => {
    loadRule(currentCA, currentRule, lookup)
    canvasA.style.transition = 'transform 0.15s ease'
    canvasA.style.transform = 'scale(0.96)'
    setTimeout(() => {
      canvasA.style.transform = 'scale(1)'
    }, 150)
  })

  let hasSwipedOnce = false
  const cleanupSwipe = setupDualCanvasSwipe(
    wrapper,
    canvasA,
    canvasB,
    () => {
      if (!hasSwipedOnce) {
        hasSwipedOnce = true
        instruction.style.opacity = '0'
        setTimeout(() => instruction.remove(), 300)
      }
      saveRunStatistics(currentCA, currentRule.name, currentRule.hex)

      // swap
      ;[canvasA, canvasB] = [canvasB, canvasA]
      ;[currentCA, nextCA] = [nextCA, currentCA]
      ;[currentRule, nextRule] = [nextRule, currentRule]

      const h = canvasA.height
      canvasA.style.zIndex = '2'
      canvasA.style.pointerEvents = 'auto'
      canvasA.style.transform = 'translateY(0)'
      canvasA.style.opacity = '1'

      canvasB.style.zIndex = '1'
      canvasB.style.pointerEvents = 'none'
      canvasB.style.transform = `translateY(${h}px)`
      canvasB.style.opacity = '1'

      colorIndex = (colorIndex + 1) % palette.length
      const col = palette[colorIndex]
      const nextCol = palette[(colorIndex + 1) % palette.length]

      // Update colors for both canvases
      currentCA.setColors(col, bgColor)
      nextCA.setColors(nextCol, bgColor)

      currentCA.resetZoom()

      nextRule = generateRandomRule()
      loadRule(nextCA, nextRule, lookup)

      currentCA.getStatistics().initializeSimulation({
        name: `Mobile - ${currentRule.name}`,
        seedType: 'patch',
        seedPercentage: 50,
        rulesetName: currentRule.name,
        rulesetHex: currentRule.hex,
        startTime: Date.now(),
        requestedStepsPerSecond: STEPS_PER_SECOND,
      })

      reload.remove()
      reload = createReloadButton(wrapper, () => {
        loadRule(currentCA, currentRule, lookup)
        canvasA.style.transition = 'transform 0.15s ease'
        canvasA.style.transform = 'scale(0.96)'
        setTimeout(() => {
          canvasA.style.transform = 'scale(1)'
        }, 150)
      })

      console.log(`Switched to: ${currentRule.name}`)
    },
    () => currentCA.play(STEPS_PER_SECOND, currentRule.ruleset),
    () => currentCA.pause(),
  )

  const cleanupZoomA = setupPinchZoomAndPan(canvasA, currentCA)
  const cleanupZoomB = setupPinchZoomAndPan(canvasB, nextCA)

  const handleResize = () => {
    const { gridCols, gridRows, cellSize, screenWidth, screenHeight } =
      computeAdaptiveGrid()

    wrapper.style.width = `${screenWidth}px`
    wrapper.style.height = `${screenHeight}px`

    for (const c of [canvasA, canvasB]) {
      c.style.width = `${screenWidth}px`
      c.style.height = `${screenHeight}px`
    }

    currentCA.pause()
    nextCA.pause()
    currentCA.resize(gridRows, gridCols)
    nextCA.resize(gridRows, gridCols)

    if (canvasB.style.transform.includes('translateY')) {
      canvasB.style.transform = `translateY(${screenHeight}px)`
    }

    console.log(`[resize] ${gridCols}×${gridRows} @ cellSize=${cellSize}px`)
  }

  window.addEventListener('resize', handleResize)

  return () => {
    currentCA.pause()
    nextCA.pause()
    cleanupSwipe()
    cleanupZoomA()
    cleanupZoomB()
    cleanupHeader()
    window.removeEventListener('resize', handleResize)
  }
}
