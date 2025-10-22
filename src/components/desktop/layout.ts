import { saveRun } from '../../api/save'
import { CellularAutomata } from '../../cellular-automata-cpu.ts'
import { AudioEngine } from '../../components/audioEngine.ts'
import { outlierRule } from '../../outlier-rule.ts'
import type { C4OrbitsData, C4Ruleset, RunSubmission } from '../../schema.ts'
import type { CleanupFunction } from '../../types'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  coords10x14,
  coords32x16,
  expandC4Ruleset,
  makeC4Ruleset,
  mutateC4Ruleset,
  randomC4RulesetByDensity,
} from '../../utils.ts'

import { getRunStatsSnapshot } from '../../api/statistics-utils.ts'
import { fetchStatistics } from '../../api/statistics.ts'
import {
  parseURLRuleset,
  parseURLState,
  updateURLWithoutReload,
} from '../../urlState.ts'
import { generateSimulationMetricsHTML } from '../shared/simulationInfo.ts'
import { generateStatsHTML, getInterestColorClass } from '../shared/stats.ts'
import { getCurrentThemeColors } from '../shared/theme.ts'
import { setupBenchmarkModal } from './benchmark.ts'
import { setupDataModeLayout } from './dataMode.ts'
import { createHeader } from './header.ts'
import { createLeaderboardPanel } from './leaderboard.ts'
import {
  type PatternInspectorData,
  createPatternInspector,
} from './patternInspector.ts'
import { createProgressBar } from './progressBar.ts'
import { createRulesetPanel } from './ruleset.ts'
import { createSimulationPanel } from './simulation.ts'
import { createStatisticsPanel, renderStatistics } from './statistics.ts'
import { createStatsBar } from './statsBar.ts'
import { type SummaryPanelElements, createSummaryPanel } from './summary.ts'
import { type TabId, createTabContainer } from './tabContainer.ts'
import { setupTheme } from './theme.ts'
import { createZoomSlider } from './zoomSlider.ts'

const PROGRESS_BAR_STEPS = 500
const GRID_ROWS = 400
const GRID_COLS = 400

// --- Types -----------------------------------------------------------------
type DisplayMode = 'orbits' | 'full'

// --- Color Management ------------------------------------------------------
// Colors are now managed by getCurrentThemeColors() from '../shared/theme.ts'

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
  selectedCell?: { type: 'orbit' | 'pattern'; index: number } | null,
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

    // Draw blue border around selected cell
    if (selectedCell && selectedCell.type === 'orbit') {
      const { x, y } = coords10x14(selectedCell.index)
      ctx.strokeStyle = '#3b82f6' // blue-500
      ctx.lineWidth = 3
      ctx.strokeRect(x * cellW, y * cellH, cellW, cellH)
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

    // Draw blue border around selected cell
    if (selectedCell && selectedCell.type === 'pattern') {
      const { x, y } = coords32x16(selectedCell.index)
      ctx.strokeStyle = '#3b82f6' // blue-500
      ctx.lineWidth = 3
      ctx.strokeRect(x * cellW, y * cellH, cellW, cellH)
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
  statsBarComponent?: ReturnType<typeof createStatsBar>,
  autosaveCallback?: () => void,
  audioEngine?: AudioEngine | null,
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

    // Check for autosave after updating progress
    if (autosaveCallback) {
      autosaveCallback()
    }
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

  // Update stats bar (for Explore tab)
  if (statsBarComponent) {
    statsBarComponent.update({
      population: current.population,
      activity: current.activity,
      interestScore,
      stepCount: metadata?.stepCount ?? 0,
    })
  }

  // Update audio engine with current statistics
  if (audioEngine) {
    audioEngine.updateFromStats(current)
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
  onSelectionChange: (selection: {
    type: 'orbit' | 'pattern'
    index: number
  }) => void,
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

    onSelectionChange({ type: 'orbit', index: orbitIndex })
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

    onSelectionChange({ type: 'pattern', index: patternIndex })
  }
}

// --- Desktop Layout ---------------------------------------------------------
export async function setupDesktopLayout(
  appRoot: HTMLDivElement,
): Promise<CleanupFunction> {
  // Check for data mode
  const urlParams = new URLSearchParams(window.location.search)
  if (urlParams.get('dataMode') === 'true') {
    console.log('[desktop] Data mode detected, routing to data mode layout')
    return setupDataModeLayout(appRoot)
  }

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

  // Create AudioEngine for sonification
  let audioEngine: AudioEngine | null = null

  const handleSoundToggle = (enabled: boolean) => {
    if (enabled) {
      // Get volume from localStorage (0-100) and convert to 0-1
      const volumePercent = Number.parseInt(
        localStorage.getItem('sound-volume') || '30',
      )
      const volume = volumePercent / 100
      audioEngine = new AudioEngine(volume)
      audioEngine.start()
    } else {
      audioEngine?.stop()
      audioEngine = null
    }
  }

  const handleVolumeChange = (volume: number) => {
    if (audioEngine) {
      audioEngine.setVolume(volume)
    }
  }

  // Create header with sound controls
  const header = createHeader(handleSoundToggle, handleVolumeChange)
  appRoot.appendChild(header.root)

  // Restore sound state from localStorage on page load
  const soundEnabled = localStorage.getItem('sound-enabled') === 'true'
  if (soundEnabled) {
    const volumePercent = Number.parseInt(
      localStorage.getItem('sound-volume') || '30',
    )
    const volume = volumePercent / 100
    audioEngine = new AudioEngine(volume)
    audioEngine.start()
  }

  // Create progress bar (no button - autosave enabled)
  const progressBar = createProgressBar({
    initialValue: 0,
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
  const statsBar = createStatsBar()
  leftColumn.appendChild(simulationContainer)
  leftColumn.appendChild(summaryPanel.root)
  leftColumn.appendChild(statsBar.root)

  const rightColumn = document.createElement('div')
  rightColumn.className = 'flex flex-col items-center gap-3'

  const rulesetPanel = createRulesetPanel()
  const patternInspector = createPatternInspector()
  rightColumn.appendChild(rulesetPanel.root)
  rightColumn.appendChild(patternInspector.root)

  // Leaderboard column (full-width for leaderboard tab)
  const leaderboardColumn = document.createElement('div')
  leaderboardColumn.className = 'flex flex-col items-center gap-3 w-full'
  const leaderboardPanel = createLeaderboardPanel()
  leaderboardColumn.appendChild(leaderboardPanel.root)

  // Statistics column (full-width for statistics tab)
  const statisticsColumn = document.createElement('div')
  statisticsColumn.className = 'flex flex-col items-center gap-3 w-full'
  const statisticsPanel = createStatisticsPanel()
  statisticsColumn.appendChild(statisticsPanel.root)

  mainContainer.appendChild(leftColumn)
  mainContainer.appendChild(rightColumn)
  mainContent.appendChild(mainContainer)
  mainContent.appendChild(leaderboardColumn)
  mainContent.appendChild(statisticsColumn)
  appRoot.appendChild(mainContent)

  // Create footer with build info
  const footer = document.createElement('footer')
  footer.className =
    'w-full px-6 py-3 border-t border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900'

  const footerContent = document.createElement('div')
  footerContent.className =
    'max-w-7xl mx-auto flex justify-center items-center gap-4 text-xs text-gray-500 dark:text-gray-400'

  // Dynamically import build info
  let buildInfoHTML = '<span>Build info unavailable</span>'
  try {
    const { BUILD_INFO } = await import('../../buildInfo.ts')
    const buildDate = new Date(BUILD_INFO.buildTime)
    const formattedDate = buildDate.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
    buildInfoHTML = `
      <span>Build: <code class="font-mono text-gray-700 dark:text-gray-300">${BUILD_INFO.commitHash}</code></span>
      <span class="text-gray-300 dark:text-gray-600">|</span>
      <span>${formattedDate}</span>
    `
  } catch (e) {
    console.warn('[footer] Build info not available:', e)
  }

  footerContent.innerHTML = buildInfoHTML
  footer.appendChild(footerContent)
  appRoot.appendChild(footer)

  // Extract elements
  const {
    canvas: simCanvas,
    btnStep,
    btnReset,
    btnPlay,
    btnBenchmark,
    btnHeadless,
    btnStar,
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
    btnMutate,
    orbitSlider,
    orbitValue,
    mutationSlider,
    mutationValue,
    radioDisplayOrbits,
    radioDisplayFull,
  } = rulesetPanel.elements

  const ctx = ruleCanvas.getContext('2d') as CanvasRenderingContext2D

  // Helper to show/hide elements based on active tab
  function updateTabVisibility(tabId: TabId, caInstance?: CellularAutomata) {
    const exploreVisible = tabId === 'explore'
    const analyzeVisible = tabId === 'analyze'
    const leaderboardVisible = tabId === 'leaderboard'
    const statisticsVisible = tabId === 'statistics'

    // Show/hide main containers based on tab
    mainContainer.style.display =
      exploreVisible || analyzeVisible ? 'flex' : 'none'
    leftColumn.style.display =
      exploreVisible || analyzeVisible ? 'flex' : 'none'
    rightColumn.style.display = exploreVisible ? 'flex' : 'none'
    leaderboardColumn.style.display = leaderboardVisible ? 'flex' : 'none'
    statisticsColumn.style.display = statisticsVisible ? 'flex' : 'none'

    if (exploreVisible) {
      // Explore: full simulation + full ruleset + pattern inspector + stats bar
      simulationContainer.style.display = 'flex'
      summaryPanel.root.style.display = 'none'
      statsBar.root.style.display = 'block'
      rulesetPanel.root.style.display = 'flex'
      patternInspector.root.style.display = 'block'
      simCanvas.width = 400
      simCanvas.height = 400
      // Re-render if CA is initialized
      if (caInstance) {
        caInstance.render()
      }
    } else if (analyzeVisible) {
      // Analyze: only summary panel
      simulationContainer.style.display = 'none'
      summaryPanel.root.style.display = 'flex'
      statsBar.root.style.display = 'none'
      rulesetPanel.root.style.display = 'none'
      patternInspector.root.style.display = 'none'
    }
  }

  // Load orbit data
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)

  console.log(`Loaded ${orbitsData.orbits.length} C4 orbits`)

  // Initialize cellular automata with colors
  const colors = getCurrentThemeColors()
  // Callback placeholder for died-out detection (set after simulation panel creation)
  // biome-ignore lint/style/useConst: reassigned later at line 1064
  let onDiedOutCallback: (() => void) | undefined
  const cellularAutomata = new CellularAutomata(simCanvas, {
    gridRows: GRID_ROWS,
    gridCols: GRID_COLS,
    fgColor: colors.fgColor,
    bgColor: colors.bgColor,
    onDiedOut: () => onDiedOutCallback?.(),
  })

  // Create tab container (must be after cellularAutomata is initialized)
  const tabContainer = createTabContainer({
    onTabChange: (tabId) => {
      updateTabVisibility(tabId, cellularAutomata)
      // Auto-refresh leaderboard when entering that tab
      if (tabId === 'leaderboard') {
        leaderboardPanel.elements.refreshButton.click()
      }
      // Auto-refresh statistics when entering that tab
      if (tabId === 'statistics') {
        statisticsPanel.elements.refreshButton.click()
      }
    },
  })
  // Insert tab container after header
  appRoot.insertBefore(tabContainer.root, appRoot.children[1])

  // Parse URL state for shareable links
  const urlState = parseURLState()
  const urlRuleset = parseURLRuleset()

  // State - declare before using in URL parameter processing
  let currentRuleset: C4Ruleset
  let initialConditionType: 'center' | 'random' | 'patch' = 'patch'
  let displayMode: DisplayMode = 'orbits'
  let statsUpdateInterval: number | null = null
  let selectedCell: { type: 'orbit' | 'pattern'; index: number } | null = null
  let isStarred = false

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
      statsBar,
      undefined,
      audioEngine,
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
    const colors = getCurrentThemeColors()
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
    isStarred = false
    updateStarButtonAppearance()
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

  // Auto-select first cell (index 0) on page load
  if (displayMode === 'orbits') {
    const orbit = orbitsData.orbits[0]
    const output = currentRuleset[0]
    const representative = orbit.representative
    const bits = []
    for (let i = 0; i < 9; i++) {
      bits.push((representative >> i) & 1)
    }
    patternInspector.update({
      type: 'orbit',
      index: 0,
      output,
      bits,
      stabilizer: orbit.stabilizer,
      size: orbit.size,
    })
    selectedCell = { type: 'orbit', index: 0 }
  } else {
    const expandedRuleset = expandC4Ruleset(currentRuleset, orbitLookup)
    const output = expandedRuleset[0]
    const orbitId = orbitLookup[0]
    const bits = []
    for (let i = 0; i < 9; i++) {
      bits.push((0 >> i) & 1)
    }
    patternInspector.update({
      type: 'pattern',
      index: 0,
      output,
      bits,
      orbitId,
    })
    selectedCell = { type: 'pattern', index: 0 }
  }

  // Re-render with selection
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
    selectedCell,
  )

  // Setup theme with re-render callback
  const cleanupTheme = setupTheme(header.elements.themeToggle, () => {
    const newColors = getCurrentThemeColors()
    cellularAutomata.setColors(newColors.fgColor, newColors.bgColor)
    // Explicit render after color change
    cellularAutomata.render()
    updateStatisticsDisplay(
      cellularAutomata,
      summaryPanel.elements,
      progressBar,
      statsBar,
      undefined,
      audioEngine,
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

  // Data mode button
  addEventListener(btnHeadless, 'click', () => {
    window.location.href = `${window.location.origin}${window.location.pathname}?dataMode=true`
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
      (selection) => {
        selectedCell = selection
        const colors = getCurrentThemeColors()
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
          selectedCell,
        )
      },
    )
  }
  addEventListener(ruleCanvas, 'click', canvasClickHandler)
  ruleCanvas.style.cursor = 'pointer'

  // Helper function to update star button appearance
  function updateStarButtonAppearance() {
    const isDark = document.documentElement.classList.contains('dark')

    if (isStarred) {
      btnStar.textContent = '★ Starred'
      btnStar.style.backgroundColor = isDark ? '#422006' : '#fef3c7' // yellow-900 : yellow-100
      btnStar.style.borderColor = isDark ? '#ca8a04' : '#fbbf24' // yellow-600 : yellow-400
    } else {
      btnStar.textContent = '☆ Star'
      btnStar.style.backgroundColor = isDark ? '#1f2937' : '#f9fafb' // gray-800 : gray-50
      btnStar.style.borderColor = isDark ? '#4b5563' : '#d1d5db' // gray-600 : gray-300
    }
  }

  // Event Listeners
  addEventListener(btnStar, 'click', () => {
    isStarred = !isStarred
    updateStarButtonAppearance()
  })

  addEventListener(btnConway, 'click', () => {
    const ruleset = makeC4Ruleset(conwayRule, orbitLookup)
    currentRuleset = ruleset
    const colors = getCurrentThemeColors()
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
    isStarred = false
    updateStarButtonAppearance()
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
    const colors = getCurrentThemeColors()
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
    isStarred = false
    updateStarButtonAppearance()
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

  addEventListener(btnMutate, 'click', () => {
    const mutationPercentage = Number.parseInt(mutationSlider.value)
    const magnitude = mutationPercentage / 100
    const mutated = mutateC4Ruleset(currentRuleset, magnitude, true)
    currentRuleset = mutated
    const colors = getCurrentThemeColors()
    // Remove existing "(mutated)" suffix before adding a new one
    const baseName =
      ruleLabelDisplay.textContent?.replace(/\s*\(mutated\)$/, '') || 'Unknown'
    renderRule(
      mutated,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      `${baseName} (mutated)`,
      displayMode,
      colors.fgColor,
      colors.bgColor,
    )
    isStarred = false
    updateStarButtonAppearance()
    applyInitialCondition()
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  })

  addEventListener(orbitSlider, 'input', () => {
    orbitValue.textContent = `${orbitSlider.value}%`
    generateRandomPatternRule()
  })

  addEventListener(mutationSlider, 'input', () => {
    mutationValue.textContent = `${mutationSlider.value}%`
  })

  radioDisplayOrbits.checked = true
  addEventListener(radioDisplayOrbits, 'change', () => {
    if (radioDisplayOrbits.checked) {
      displayMode = 'orbits'
      const colors = getCurrentThemeColors()
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
      const colors = getCurrentThemeColors()
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
      statsBar,
      undefined,
      audioEngine,
    )
  })

  // Pulse animation helpers for reset button
  const startResetPulse = () => {
    btnReset.classList.add('animate-pulse')
    btnReset.style.borderColor = '#f97316' // Orange border
    btnReset.style.borderWidth = '2px'
  }

  const stopResetPulse = () => {
    btnReset.classList.remove('animate-pulse')
    btnReset.style.borderColor = ''
    btnReset.style.borderWidth = ''
  }

  // Wire up died-out callback to pulse reset button
  onDiedOutCallback = startResetPulse

  addEventListener(btnReset, 'click', () => {
    // Stop pulse when user manually resets
    stopResetPulse()

    // Soft reset for patch and random modes (advances seed for new random ICs)
    // Center mode keeps existing behavior (deterministic single pixel)
    if (initialConditionType === 'patch' || initialConditionType === 'random') {
      const wasPlaying = cellularAutomata.isCurrentlyPlaying()
      cellularAutomata.pause()
      cellularAutomata.clearGrid()
      cellularAutomata.softReset()
      cellularAutomata.render()
      updateStatisticsDisplay(
        cellularAutomata,
        summaryPanel.elements,
        progressBar,
        statsBar,
        undefined,
        audioEngine,
      )
      initializeSimulationMetadata()
      updateURL()

      // Resume playing if it was playing before reset
      if (wasPlaying) {
        const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
        const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
        cellularAutomata.play(stepsPerSecond, expanded)
      }
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
          statsBar,
          checkAndAutosave,
          audioEngine,
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
          statsBar,
          checkAndAutosave,
          audioEngine,
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

  // Export button handlers
  addEventListener(summaryPanel.elements.copyJsonButton, 'click', async () => {
    const stats = cellularAutomata.getStatistics()
    const metadata = stats.getMetadata()
    const recent = stats.getRecentStats(1)[0]
    const interestScore = stats.calculateInterestScore()

    const exportData = {
      rulesetName: metadata?.rulesetName ?? 'Unknown',
      rulesetHex: c4RulesetToHex(currentRuleset),
      seed: cellularAutomata.getSeed(),
      seedType: metadata?.seedType,
      seedPercentage: metadata?.seedPercentage,
      stepCount: metadata?.stepCount ?? 0,
      elapsedTime: stats.getElapsedTime(),
      actualSps: stats.getActualStepsPerSecond(),
      requestedSps: metadata?.requestedStepsPerSecond,
      gridSize: cellularAutomata.getGridSize(),
      population: recent?.population ?? 0,
      activity: recent?.activity ?? 0,
      populationChange: recent?.populationChange ?? 0,
      entropy2x2: recent?.entropy2x2 ?? 0,
      entropy4x4: recent?.entropy4x4 ?? 0,
      entropy8x8: recent?.entropy8x8 ?? 0,
      entityCount: recent?.entityCount ?? 0,
      entityChange: recent?.entityChange ?? 0,
      totalEntitiesEverSeen: recent?.totalEntitiesEverSeen ?? 0,
      uniquePatterns: recent?.uniquePatterns ?? 0,
      entitiesAlive: recent?.entitiesAlive ?? 0,
      entitiesDied: recent?.entitiesDied ?? 0,
      interestScore,
    }

    const jsonString = JSON.stringify(exportData, null, 2)

    try {
      await navigator.clipboard.writeText(jsonString)
      const btn = summaryPanel.elements.copyJsonButton
      const originalHTML = btn.innerHTML
      btn.innerHTML = `
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
        </svg>
        <span>Copied!</span>
      `
      btn.className = btn.className.replace(
        'bg-blue-600 hover:bg-blue-700',
        'bg-green-600 hover:bg-green-700',
      )
      setTimeout(() => {
        btn.innerHTML = originalHTML
        btn.className = btn.className.replace(
          'bg-green-600 hover:bg-green-700',
          'bg-blue-600 hover:bg-blue-700',
        )
      }, 2000)
    } catch (err) {
      console.error('Failed to copy JSON:', err)
    }
  })

  addEventListener(summaryPanel.elements.exportCsvButton, 'click', () => {
    const stats = cellularAutomata.getStatistics()
    const metadata = stats.getMetadata()
    const recent = stats.getRecentStats(1)[0]
    const interestScore = stats.calculateInterestScore()

    const csvData = [
      ['Field', 'Value'],
      ['Ruleset Name', metadata?.rulesetName ?? 'Unknown'],
      ['Ruleset Hex', c4RulesetToHex(currentRuleset)],
      ['Seed', cellularAutomata.getSeed().toString()],
      ['Seed Type', metadata?.seedType ?? ''],
      ['Seed Percentage', metadata?.seedPercentage?.toString() ?? ''],
      ['Step Count', (metadata?.stepCount ?? 0).toString()],
      ['Elapsed Time (ms)', stats.getElapsedTime().toString()],
      ['Actual SPS', stats.getActualStepsPerSecond().toFixed(2)],
      ['Requested SPS', metadata?.requestedStepsPerSecond?.toString() ?? ''],
      ['Grid Size', cellularAutomata.getGridSize().toString()],
      ['Population', (recent?.population ?? 0).toString()],
      ['Activity', (recent?.activity ?? 0).toString()],
      ['Population Change', (recent?.populationChange ?? 0).toString()],
      ['Entropy 2x2', (recent?.entropy2x2 ?? 0).toFixed(4)],
      ['Entropy 4x4', (recent?.entropy4x4 ?? 0).toFixed(4)],
      ['Entropy 8x8', (recent?.entropy8x8 ?? 0).toFixed(4)],
      ['Entity Count', (recent?.entityCount ?? 0).toString()],
      ['Entity Change', (recent?.entityChange ?? 0).toString()],
      [
        'Total Entities Ever Seen',
        (recent?.totalEntitiesEverSeen ?? 0).toString(),
      ],
      ['Unique Patterns', (recent?.uniquePatterns ?? 0).toString()],
      ['Entities Alive', (recent?.entitiesAlive ?? 0).toString()],
      ['Entities Died', (recent?.entitiesDied ?? 0).toString()],
      ['Interest Score', interestScore.toFixed(2)],
    ]

    const csvContent = csvData
      .map((row) => row.map((field) => `"${field}"`).join(','))
      .join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `rulehunt-${metadata?.rulesetName ?? 'simulation'}-${Date.now()}.csv`
    link.click()
    URL.revokeObjectURL(url)

    const btn = summaryPanel.elements.exportCsvButton
    const originalHTML = btn.innerHTML
    btn.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
      </svg>
      <span>Exported!</span>
    `
    btn.className = btn.className.replace(
      'bg-green-600 hover:bg-green-700',
      'bg-blue-600 hover:bg-blue-700',
    )
    setTimeout(() => {
      btn.innerHTML = originalHTML
      btn.className = btn.className.replace(
        'bg-blue-600 hover:bg-blue-700',
        'bg-green-600 hover:bg-green-700',
      )
    }, 2000)
  })

  // Autosave logic: track progress and autosave when reaching 100%
  let hasAutosaved = false

  function checkAndAutosave() {
    const progress = progressBar.value()

    if (progress >= 100 && !hasAutosaved) {
      hasAutosaved = true

      console.log('[desktop] Progress reached 100%, autosaving...')

      // --- Gather statistics ---
      const stats = cellularAutomata.getStatistics()
      const { metadata, recent } = getRunStatsSnapshot(cellularAutomata)

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
        isStarred,
        simVersion: 'v0.1.0-desktop-autosave',
        engineCommit: undefined,
        extraScores: undefined,
      }

      // --- Fire and forget background save ---
      saveRun(runPayload)
        .then(() => {
          console.log('[desktop] Autosave successful')
          // Wait 3 seconds, then auto-mutate
          setTimeout(() => {
            console.log('[desktop] Auto-mutating to new ruleset...')
            btnMutate.click()
            hasAutosaved = false // Reset for next cycle
          }, 3000)
        })
        .catch((error) => {
          console.error('[desktop] Autosave failed:', error)
          // Still reset and mutate even if save failed
          setTimeout(() => {
            console.log('[desktop] Auto-mutating to new ruleset...')
            btnMutate.click()
            hasAutosaved = false
          }, 3000)
        })
    }
  }

  // Mobile preview toggle
  if (header.elements.mobilePreviewButton) {
    let mobilePreviewActive = false

    const toggleMobilePreview = () => {
      if (!mobilePreviewActive) {
        // Enter mobile preview mode
        mobilePreviewActive = true

        // Create mobile preview wrapper with pointer-events-none to let touches pass through
        const mobileWrapper = document.createElement('div')
        mobileWrapper.id = 'mobile-preview-wrapper'
        mobileWrapper.className =
          'fixed inset-0 z-40 flex flex-col justify-center items-center gap-4 bg-black/20 backdrop-blur-sm p-8 pointer-events-none'

        // Create return button (outside phone frame) - re-enable pointer events
        const returnButton = document.createElement('button')
        returnButton.className =
          'px-6 py-3 bg-black/80 dark:bg-white/80 text-white dark:text-black rounded-lg cursor-pointer hover:bg-black/90 dark:hover:bg-white/90 transition-colors font-medium shadow-lg pointer-events-auto'
        returnButton.textContent = '← Return to Desktop'
        returnButton.onclick = toggleMobilePreview

        // Create phone frame with fixed height - re-enable pointer events and cursor
        const phoneFrame = document.createElement('div')
        phoneFrame.className =
          'w-[390px] h-[844px] bg-white dark:bg-gray-900 shadow-2xl rounded-[30px] flex flex-col border-2 border-purple-500 overflow-hidden pointer-events-auto cursor-pointer'

        // Mobile app root fills the entire phone frame
        phoneFrame.innerHTML =
          '<div id="mobile-app-root" style="width: 100%; height: 100%; position: relative;"></div>'

        mobileWrapper.appendChild(returnButton)
        mobileWrapper.appendChild(phoneFrame)

        // Hide desktop content and show mobile preview
        appRoot.style.display = 'none'
        document.body.appendChild(mobileWrapper)

        // Initialize mobile layout in the phone frame after layout completes
        const mobileAppRoot = document.getElementById(
          'mobile-app-root',
        ) as HTMLDivElement
        ;(async () => {
          // Wait for layout to complete so dimensions are available
          await new Promise((resolve) => requestAnimationFrame(resolve))
          const { setupMobileLayout } = await import('../mobile/layout.ts')
          await setupMobileLayout(mobileAppRoot)
        })()

        console.log('[desktop] Mobile preview activated')
      } else {
        // Exit mobile preview mode
        mobilePreviewActive = false

        // Remove mobile preview wrapper
        const wrapper = document.getElementById('mobile-preview-wrapper')
        if (wrapper) {
          wrapper.remove()
        }

        // Restore desktop content
        appRoot.style.display = ''

        console.log('[desktop] Mobile preview deactivated')
      }
    }

    addEventListener(
      header.elements.mobilePreviewButton,
      'click',
      toggleMobilePreview,
    )

    // Add ESC key handler
    const escKeyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobilePreviewActive) {
        toggleMobilePreview()
      }
    }
    window.addEventListener('keydown', escKeyHandler)

    // Add ESC cleanup to the cleanup function below
    eventListeners.push({
      element: window,
      event: 'keydown',
      handler: escKeyHandler as EventListener,
    })
  }

  // Statistics refresh logic
  let currentStatsChartCleanup: (() => void) | null = null
  addEventListener(
    statisticsPanel.elements.refreshButton,
    'click',
    async () => {
      try {
        statisticsPanel.elements.refreshButton.disabled = true
        statisticsPanel.elements.refreshButton.textContent = '⏳ Loading...'

        const stats = await fetchStatistics()

        if (stats) {
          // Clean up old charts before rendering new ones
          if (currentStatsChartCleanup) {
            currentStatsChartCleanup()
          }
          // Render new charts
          const { destroy } = renderStatistics(statisticsPanel.elements, stats)
          currentStatsChartCleanup = destroy
        }
      } catch (error) {
        console.error('[statistics] Error fetching statistics:', error)
      } finally {
        statisticsPanel.elements.refreshButton.disabled = false
        statisticsPanel.elements.refreshButton.textContent = '🔄 Refresh'
      }
    },
  )

  // Initialize tab visibility
  updateTabVisibility(tabContainer.getActiveTab(), cellularAutomata)

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
    if (currentStatsChartCleanup) {
      currentStatsChartCleanup()
    }
    if (audioEngine) {
      audioEngine.stop()
    }
    for (const id of intervals) {
      window.clearInterval(id)
    }
    for (const { element, event, handler } of eventListeners) {
      element.removeEventListener(event, handler)
    }
    cleanupTheme()
    benchmarkModal.cleanup()
    tabContainer.cleanup()
    console.log('Desktop layout cleaned up')
  }
}
