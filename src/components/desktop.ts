import { saveRun } from '../api/save'
import { CellularAutomata } from '../cellular-automata-cpu.ts'
import { outlierRule } from '../outlier-rule.ts'
import type { C4OrbitsData, C4Ruleset, RunSubmission } from '../schema.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  coords10x14,
  coords32x16,
  expandC4Ruleset,
  makeC4Ruleset,
  randomC4RulesetByDensity,
} from '../utils.ts'

import {
  parseURLRuleset,
  parseURLState,
  updateURLWithoutReload,
} from '../urlState.ts'
import { setupBenchmarkModal } from './benchmark.ts'
import { createHeader, setupTheme } from './desktopHeader.ts'
import { createLeaderboardPanel } from './leaderboard.ts'
import {
  type PatternInspectorData,
  createPatternInspector,
} from './patternInspector.ts'
import { createProgressBar } from './progressBar.ts'
import { createRulesetPanel } from './ruleset.ts'
import { generateSimulationMetricsHTML } from './shared/simulationInfo.ts'
import { generateStatsHTML, getInterestColorClass } from './shared/stats.ts'
import { createSimulationPanel } from './simulation.ts'
import { type SummaryPanelElements, createSummaryPanel } from './summary.ts'
import { createZoomSlider } from './zoomSlider.ts'

const PROGRESS_BAR_STEPS = 500
const GRID_ROWS = 400
const GRID_COLS = 400

// --- Types -----------------------------------------------------------------
export type CleanupFunction = () => void
type DisplayMode = 'orbits' | 'full'

// --- Color Management ------------------------------------------------------
function getCurrentColors(): { fgColor: string; bgColor: string } {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    fgColor: isDark ? '#a78bfa' : '#9333ea', // violet-400 : violet-600
    bgColor: isDark ? '#1e1e1e' : '#ffffff',
  }
}

// --- Desktop-Specific Rendering --------------------------------------------
function renderRule(
  ruleset: C4Ruleset,
  orbitLookup: Uint8Array,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ruleLabelDisplay: HTMLElement,
  ruleIdDisplay: HTMLElement,
  ruleLabel: string,
  displayMode: DisplayMode,
  fgColor: string,
  bgColor: string,
) {
  if (displayMode === 'orbits') {
    const cols = 10
    const rows = 14
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = fgColor

    for (let orbit = 0; orbit < 140; orbit++) {
      if (ruleset[orbit]) {
        const { x, y } = coords10x14(orbit)
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
      }
    }
  } else {
    const cols = 32
    const rows = 16
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    ctx.fillStyle = bgColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = fgColor

    const expandedRuleset = expandC4Ruleset(ruleset, orbitLookup)

    for (let pattern = 0; pattern < 512; pattern++) {
      if (expandedRuleset[pattern]) {
        const { x, y } = coords32x16(pattern)
        ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
      }
    }
  }

  const hex35 = c4RulesetToHex(ruleset)
  ruleLabelDisplay.textContent = `${ruleLabel}`
  ruleIdDisplay.textContent = `${hex35}`
}

function updateStatisticsDisplay(
  cellularAutomata: CellularAutomata,
  elements: SummaryPanelElements,
  progressBar: ReturnType<typeof createProgressBar>,
) {
  const stats = cellularAutomata.getStatistics()
  const recentStats = stats.getRecentStats(1)
  const metadata = stats.getMetadata()

  if (recentStats.length === 0) return

  const current = recentStats[0]
  const interestScore = stats.calculateInterestScore()

  if (metadata) {
    const stepCount = metadata.stepCount
    const progressPercent = Math.min(
      (stepCount / PROGRESS_BAR_STEPS) * 100,
      100,
    )
    progressBar.set(Math.round(progressPercent))
  }

  // Update simulation metrics
  if (metadata) {
    const metricsData = {
      rulesetName: metadata.rulesetName,
      rulesetHex: metadata.rulesetHex,
      seedType: metadata.seedType,
      seedPercentage: metadata.seedPercentage,
      stepCount: metadata.stepCount,
      elapsedTime: stats.getElapsedTime(),
      actualSps: stats.getActualStepsPerSecond(),
      requestedSps: metadata.requestedStepsPerSecond,
      gridSize: cellularAutomata.getGridSize(),
    }
    elements.metricsContainer.innerHTML =
      generateSimulationMetricsHTML(metricsData)
  }

  // Generate stats HTML and update the container
  const statsData = { ...current, interestScore }
  elements.statsContainer.innerHTML = generateStatsHTML(statsData)

  // Apply interest score color to the interest field
  const interestField = elements.statsContainer.querySelector(
    '[data-field="interest"]',
  )
  if (interestField) {
    interestField.className = `text-gray-900 dark:text-white font-semibold text-lg ${getInterestColorClass(interestScore)}`
  }
}

function handleCanvasClick(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  currentRuleset: C4Ruleset,
  orbitsData: C4OrbitsData,
  orbitLookup: Uint8Array,
  displayMode: DisplayMode,
  onPatternClick: (data: PatternInspectorData) => void,
) {
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  if (displayMode === 'orbits') {
    const cols = 10
    const rows = 14
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    const gridX = Math.floor(x / cellW)
    const gridY = Math.floor(y / cellH)
    const orbitIndex = gridY * cols + gridX

    if (orbitIndex < 0 || orbitIndex >= 140) return

    const orbit = orbitsData.orbits[orbitIndex]
    const output = currentRuleset[orbitIndex]
    const representative = orbit.representative

    const bits = []
    for (let i = 0; i < 9; i++) {
      bits.push((representative >> i) & 1)
    }

    onPatternClick({
      type: 'orbit',
      index: orbitIndex,
      output,
      bits,
      stabilizer: orbit.stabilizer,
      size: orbit.size,
    })
  } else {
    const cols = 32
    const rows = 16
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    const gridX = Math.floor(x / cellW)
    const gridY = Math.floor(y / cellH)

    let patternIndex = -1
    for (let p = 0; p < 512; p++) {
      const coord = coords32x16(p)
      if (coord.x === gridX && coord.y === gridY) {
        patternIndex = p
        break
      }
    }

    if (patternIndex === -1) return

    const expandedRuleset = expandC4Ruleset(currentRuleset, orbitLookup)
    const output = expandedRuleset[patternIndex]
    const orbitId = orbitLookup[patternIndex]

    const bits = []
    for (let i = 0; i < 9; i++) {
      bits.push((patternIndex >> i) & 1)
    }

    onPatternClick({
      type: 'pattern',
      index: patternIndex,
      output,
      bits,
      orbitId,
    })
  }
}

// --- Desktop Layout ---------------------------------------------------------
export async function setupDesktopLayout(
  appRoot: HTMLDivElement,
): Promise<CleanupFunction> {
  // Track all cleanup tasks
  const eventListeners: Array<{
    element: EventTarget
    event: string
    handler: EventListenerOrEventListenerObject
  }> = []
  const intervals: number[] = []

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

  const setInterval = (handler: () => void, ms: number): number => {
    const id = window.setInterval(handler, ms)
    intervals.push(id)
    return id
  }

  const clearInterval = (id: number) => {
    window.clearInterval(id)
    const index = intervals.indexOf(id)
    if (index > -1) intervals.splice(index, 1)
  }

  // Create header
  const header = createHeader()
  appRoot.appendChild(header.root)

  // Create progress bar
  const progressBar = createProgressBar({
    initialValue: 0,
    buttonLabel: 'Save to Leaderboard',
  })
  const progressContainer = document.createElement('div')
  progressContainer.className =
    'w-full px-6 py-4 border-b border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'
  const progressWrapper = document.createElement('div')
  progressWrapper.className = 'max-w-7xl mx-auto'
  progressWrapper.appendChild(progressBar.root)
  progressContainer.appendChild(progressWrapper)
  appRoot.appendChild(progressContainer)

  // Create main content
  const mainContent = document.createElement('main')
  mainContent.className =
    'flex-1 flex items-center justify-center gap-6 p-6 lg:p-12'

  const mainContainer = document.createElement('div')
  mainContainer.className =
    'flex flex-col lg:flex-row items-start justify-center gap-12 w-full max-w-7xl'

  const leftColumn = document.createElement('div')
  leftColumn.className = 'flex flex-col items-center gap-3'

  // Create simulation canvas container with zoom slider on the left
  const simulationContainer = document.createElement('div')
  simulationContainer.className = 'flex items-start gap-4'

  const simulationPanel = createSimulationPanel()
  const zoomSlider = createZoomSlider({ initial: 1, min: 1, max: 100 })

  // Add zoom slider first (left side), then simulation panel
  simulationContainer.appendChild(zoomSlider.root)
  simulationContainer.appendChild(simulationPanel.root)

  const summaryPanel = createSummaryPanel()
  leftColumn.appendChild(simulationContainer)
  leftColumn.appendChild(summaryPanel.root)

  const rightColumn = document.createElement('div')
  rightColumn.className = 'flex flex-col items-center gap-3'

  const rulesetPanel = createRulesetPanel()
  const patternInspector = createPatternInspector()
  const leaderboardPanel = createLeaderboardPanel()
  rightColumn.appendChild(rulesetPanel.root)
  rightColumn.appendChild(patternInspector.root)
  rightColumn.appendChild(leaderboardPanel.root)

  mainContainer.appendChild(leftColumn)
  mainContainer.appendChild(rightColumn)
  mainContent.appendChild(mainContainer)
  appRoot.appendChild(mainContent)

  // Extract elements
  const {
    canvas: simCanvas,
    btnStep,
    btnReset,
    btnPlay,
    btnBenchmark,
    stepsPerSecondInput,
    aliveSlider,
    aliveValue,
    radioCenterSeed,
    radioRandomSeed,
    radioPatchSeed,
  } = simulationPanel.elements

  const {
    canvas: ruleCanvas,
    ruleLabel: ruleLabelDisplay,
    ruleId: ruleIdDisplay,
    btnConway,
    btnOutlier,
    btnRandomC4Ruleset,
    orbitSlider,
    orbitValue,
    radioDisplayOrbits,
    radioDisplayFull,
  } = rulesetPanel.elements

  const ctx = ruleCanvas.getContext('2d') as CanvasRenderingContext2D

  // Load orbit data
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)

  console.log(`Loaded ${orbitsData.orbits.length} C4 orbits`)

  // Initialize cellular automata with colors
  const colors = getCurrentColors()
  const cellularAutomata = new CellularAutomata(simCanvas, {
    gridRows: GRID_ROWS,
    gridCols: GRID_COLS,
    fgColor: colors.fgColor,
    bgColor: colors.bgColor,
  })

  // Parse URL state for shareable links
  const urlState = parseURLState()
  const urlRuleset = parseURLRuleset()

  // State - declare before using in URL parameter processing
  let currentRuleset: C4Ruleset
  let initialConditionType: 'center' | 'random' | 'patch' = 'patch'
  let displayMode: DisplayMode = 'orbits'
  let statsUpdateInterval: number | null = null

  // Apply URL seed if provided
  if (urlState.seed !== undefined) {
    cellularAutomata.setSeed(urlState.seed)
    console.log('[desktop] Using seed from URL:', urlState.seed)
  }

  // Apply seedType from URL if provided (affects initial condition later)
  if (urlState.seedType) {
    initialConditionType = urlState.seedType
    console.log('[desktop] Using seed type from URL:', urlState.seedType)
    // Update radio button selection
    if (urlState.seedType === 'center') {
      radioCenterSeed.checked = true
    } else if (urlState.seedType === 'random') {
      radioRandomSeed.checked = true
    } else if (urlState.seedType === 'patch') {
      radioPatchSeed.checked = true
    }
  }

  // Apply seedPercentage from URL if provided (set slider value)
  if (urlState.seedPercentage !== undefined) {
    aliveSlider.value = urlState.seedPercentage.toString()
    aliveValue.textContent = `${urlState.seedPercentage}%`
    console.log(
      '[desktop] Using seed percentage from URL:',
      urlState.seedPercentage,
    )
  }

  // Initial render after construction (constructor no longer auto-renders)
  cellularAutomata.render()

  ctx.fillStyle = colors.bgColor
  ctx.fillRect(0, 0, ruleCanvas.width, ruleCanvas.height)

  // Functions
  function applyInitialCondition() {
    if (initialConditionType === 'center') {
      cellularAutomata.centerSeed()
    } else if (initialConditionType === 'patch') {
      cellularAutomata.patchSeed()
    } else {
      const percentage = Number.parseInt(aliveSlider.value)
      cellularAutomata.randomSeed(percentage)
    }
    // Explicit render after seeding
    cellularAutomata.render()
    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
    )
    initializeSimulationMetadata()
    updateURL()
  }

  function initializeSimulationMetadata() {
    const stats = cellularAutomata.getStatistics()
    const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)

    let seedPercentage: number | undefined
    if (initialConditionType === 'random' || initialConditionType === 'patch') {
      seedPercentage = Number.parseInt(aliveSlider.value)
    }

    stats.initializeSimulation({
      name: `Simulation ${new Date().toLocaleTimeString()}`,
      seedType: initialConditionType,
      seedPercentage,
      rulesetName: ruleLabelDisplay.textContent || 'Unknown',
      rulesetHex: ruleIdDisplay.textContent || 'Unknown',
      startTime: Date.now(),
      requestedStepsPerSecond: cellularAutomata.isCurrentlyPlaying()
        ? stepsPerSecond
        : undefined,
    })
  }

  function updateURL() {
    const rulesetHex = c4RulesetToHex(currentRuleset)
    const seed = cellularAutomata.getSeed()

    let seedPercentage: number | undefined
    if (initialConditionType === 'random' || initialConditionType === 'patch') {
      seedPercentage = Number.parseInt(aliveSlider.value)
    }

    updateURLWithoutReload({
      rulesetHex,
      seed,
      seedType: initialConditionType,
      seedPercentage,
    })
  }

  function generateRandomPatternRule() {
    const percentage = Number.parseInt(orbitSlider.value)
    const density = percentage / 100
    const ruleset = randomC4RulesetByDensity(density)
    currentRuleset = ruleset
    const colors = getCurrentColors()
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      `Random Pattern (${percentage}% orbits)`,
      displayMode,
      colors.fgColor,
      colors.bgColor,
    )
    applyInitialCondition()
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
    // URL already updated by applyInitialCondition()
  }

  // Initialize with URL ruleset if available, otherwise Conway
  if (urlRuleset) {
    currentRuleset = urlRuleset.ruleset
    renderRule(
      urlRuleset.ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      'Shared Rule',
      displayMode,
      colors.fgColor,
      colors.bgColor,
    )
    console.log('[desktop] Loaded rule from URL:', urlRuleset.hex)
  } else {
    const conwayRuleset = makeC4Ruleset(conwayRule, orbitLookup)
    currentRuleset = conwayRuleset
    renderRule(
      conwayRuleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      'Conway',
      displayMode,
      colors.fgColor,
      colors.bgColor,
    )
  }

  // Now apply initial condition which will also initialize simulation metadata
  applyInitialCondition()

  // Setup theme with re-render callback
  const cleanupTheme = setupTheme(header.elements.themeToggle, () => {
    const newColors = getCurrentColors()
    cellularAutomata.setColors(newColors.fgColor, newColors.bgColor)
    // Explicit render after color change
    cellularAutomata.render()
    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
    )
    renderRule(
      currentRuleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      ruleLabelDisplay.textContent || 'Loading...',
      displayMode,
      newColors.fgColor,
      newColors.bgColor,
    )
  })

  // Setup benchmark modal
  const benchmarkModal = setupBenchmarkModal(orbitLookup)
  addEventListener(btnBenchmark, 'click', () => {
    benchmarkModal.show()
  })

  // Canvas click handler
  const canvasClickHandler = (e: MouseEvent) => {
    handleCanvasClick(
      e,
      ruleCanvas,
      currentRuleset,
      orbitsData,
      orbitLookup,
      displayMode,
      (data) => patternInspector.update(data),
    )
  }
  addEventListener(ruleCanvas, 'click', canvasClickHandler)
  ruleCanvas.style.cursor = 'pointer'

  // Event Listeners
  addEventListener(btnConway, 'click', () => {
    const ruleset = makeC4Ruleset(conwayRule, orbitLookup)
    currentRuleset = ruleset
    const colors = getCurrentColors()
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      'Conway',
      displayMode,
      colors.fgColor,
      colors.bgColor,
    )
    applyInitialCondition()
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  })

  addEventListener(btnOutlier, 'click', () => {
    const ruleset = makeC4Ruleset(outlierRule, orbitLookup)
    currentRuleset = ruleset
    const colors = getCurrentColors()
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      'Outlier',
      displayMode,
      colors.fgColor,
      colors.bgColor,
    )
    applyInitialCondition()
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  })

  addEventListener(btnRandomC4Ruleset, 'click', () => {
    generateRandomPatternRule()
  })

  addEventListener(orbitSlider, 'input', () => {
    orbitValue.textContent = `${orbitSlider.value}%`
    generateRandomPatternRule()
  })

  radioDisplayOrbits.checked = true
  addEventListener(radioDisplayOrbits, 'change', () => {
    if (radioDisplayOrbits.checked) {
      displayMode = 'orbits'
      const colors = getCurrentColors()
      renderRule(
        currentRuleset,
        orbitLookup,
        ctx,
        ruleCanvas,
        ruleLabelDisplay,
        ruleIdDisplay,
        ruleLabelDisplay.textContent || 'Loading...',
        displayMode,
        colors.fgColor,
        colors.bgColor,
      )
    }
  })

  addEventListener(radioDisplayFull, 'change', () => {
    if (radioDisplayFull.checked) {
      displayMode = 'full'
      const colors = getCurrentColors()
      renderRule(
        currentRuleset,
        orbitLookup,
        ctx,
        ruleCanvas,
        ruleLabelDisplay,
        ruleIdDisplay,
        ruleLabelDisplay.textContent || 'Loading...',
        displayMode,
        colors.fgColor,
        colors.bgColor,
      )
    }
  })

  addEventListener(radioCenterSeed, 'change', () => {
    if (radioCenterSeed.checked) {
      initialConditionType = 'center'
      applyInitialCondition()
    }
  })

  addEventListener(radioRandomSeed, 'change', () => {
    if (radioRandomSeed.checked) {
      initialConditionType = 'random'
      applyInitialCondition()
    }
  })

  addEventListener(radioPatchSeed, 'change', () => {
    if (radioPatchSeed.checked) {
      initialConditionType = 'patch'
      applyInitialCondition()
    }
  })

  addEventListener(btnStep, 'click', () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      btnPlay.textContent = 'Play'
      if (statsUpdateInterval !== null) {
        clearInterval(statsUpdateInterval)
        statsUpdateInterval = null
      }
    }
    const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
    cellularAutomata.step(expanded)
    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
    )
  })

  addEventListener(btnReset, 'click', () => {
    // Soft reset for patch and random modes (advances seed for new random ICs)
    // Center mode keeps existing behavior (deterministic single pixel)
    if (initialConditionType === 'patch' || initialConditionType === 'random') {
      cellularAutomata.pause()
      cellularAutomata.clearGrid()
      cellularAutomata.softReset()
      cellularAutomata.render()
      updateStatisticsDisplay(
        cellularAutomata,
        summaryPanel.elements,
        progressBar,
      )
      initializeSimulationMetadata()
      updateURL()
    } else {
      applyInitialCondition()
    }
  })

  addEventListener(btnPlay, 'click', () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      btnPlay.textContent = 'Play'
      if (statsUpdateInterval !== null) {
        clearInterval(statsUpdateInterval)
        statsUpdateInterval = null
      }
    } else {
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
      btnPlay.textContent = 'Pause'

      const stats = cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      if (metadata) {
        metadata.requestedStepsPerSecond = stepsPerSecond
      }

      statsUpdateInterval = setInterval(() => {
        updateStatisticsDisplay(
          cellularAutomata,
          summaryPanel.elements,
          progressBar,
        )
      }, 100)
    }
  })

  addEventListener(stepsPerSecondInput, 'change', () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      if (statsUpdateInterval !== null) {
        clearInterval(statsUpdateInterval)
      }
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)

      const stats = cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      if (metadata) {
        metadata.requestedStepsPerSecond = stepsPerSecond
      }

      statsUpdateInterval = setInterval(() => {
        updateStatisticsDisplay(
          cellularAutomata,
          summaryPanel.elements,
          progressBar,
        )
      }, 100)
    }
  })

  addEventListener(aliveSlider, 'input', () => {
    aliveValue.textContent = `${aliveSlider.value}%`
    if (initialConditionType === 'random' || initialConditionType === 'patch') {
      applyInitialCondition()
    }
  })

  // Zoom slider events
  addEventListener(zoomSlider.elements.slider, 'input', () => {
    const zoomLevel = zoomSlider.value()
    cellularAutomata.setZoom(zoomLevel)
    cellularAutomata.render()
  })

  addEventListener(zoomSlider.elements.plusButton, 'click', () => {
    const zoomLevel = zoomSlider.value()
    cellularAutomata.setZoom(zoomLevel)
    cellularAutomata.render()
  })

  addEventListener(zoomSlider.elements.minusButton, 'click', () => {
    const zoomLevel = zoomSlider.value()
    cellularAutomata.setZoom(zoomLevel)
    cellularAutomata.render()
  })

  // Save button click handler
  if (progressBar.elements.saveButton) {
    addEventListener(progressBar.elements.saveButton, 'click', () => {
      // --- Gather statistics ---
      const stats = cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      const recent = stats.getRecentStats(1)[0] ?? {
        population: 0,
        activity: 0,
        populationChange: 0,
        entropy2x2: 0,
        entropy4x4: 0,
        entropy8x8: 0,
        entityCount: 0,
        entityChange: 0,
        totalEntitiesEverSeen: 0,
        uniquePatterns: 0,
        entitiesAlive: 0,
        entitiesDied: 0,
      }

      // Always compute fresh hex from current ruleset to avoid placeholder text
      const rulesetHex = c4RulesetToHex(currentRuleset)
      const rulesetName = ruleLabelDisplay.textContent || 'Unknown'

      const interestScore = stats.calculateInterestScore()
      const watchedWallMs = stats.getElapsedTime()
      const actualSps = stats.getActualStepsPerSecond()
      const stepCount = metadata?.stepCount ?? 0

      const runPayload: Omit<RunSubmission, 'userId' | 'userLabel'> = {
        rulesetName,
        rulesetHex,
        seed: cellularAutomata.getSeed(),
        seedType: (metadata?.seedType ?? 'patch') as
          | 'center'
          | 'random'
          | 'patch',
        seedPercentage: metadata?.seedPercentage,
        stepCount,
        watchedSteps: stepCount,
        watchedWallMs,
        gridSize: cellularAutomata.getGridSize(),
        progress_bar_steps: PROGRESS_BAR_STEPS,
        requestedSps: metadata?.requestedStepsPerSecond,
        actualSps,
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
        interestScore,
        simVersion: 'v0.1.0',
        engineCommit: undefined,
        extraScores: undefined,
      }

      // --- Fire and forget background save ---
      setTimeout(() => saveRun(runPayload))
    })
  }

  // Auto-start simulation
  btnPlay.click()

  // Return cleanup function
  return () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
    }
    if (statsUpdateInterval !== null) {
      clearInterval(statsUpdateInterval)
    }
    for (const id of intervals) {
      window.clearInterval(id)
    }
    for (const { element, event, handler } of eventListeners) {
      element.removeEventListener(event, handler)
    }
    cleanupTheme()
    benchmarkModal.cleanup()
    console.log('Desktop layout cleaned up')
  }
}
