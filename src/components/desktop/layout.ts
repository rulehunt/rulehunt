import { fetchStatistics } from '../../api/statistics.ts'
import { CellularAutomata } from '../../cellular-automata-cpu.ts'
import { AudioEngine } from '../../components/audioEngine.ts'
import type { C4OrbitsData, C4Ruleset } from '../../schema.ts'
import type { CleanupFunction } from '../../types'
import {
  parseURLRuleset,
  parseURLState,
  updateURLWithoutReload,
} from '../../urlState.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  expandC4Ruleset,
  makeC4Ruleset,
  randomC4RulesetByDensity,
} from '../../utils.ts'
import { getCurrentThemeColors } from '../shared/theme.ts'
import { setupBenchmarkModal } from './benchmark.ts'
import { setupDataModeLayout } from './dataMode.ts'
import {
  setupAliveSliderHandler,
  setupDisplayModeHandlers,
  setupSeedTypeHandlers,
} from './events/displayHandlers.ts'
import {
  setupCsvExportHandler,
  setupJsonExportHandler,
} from './events/exportHandlers.ts'
import {
  setupBenchmarkHandler,
  setupHeadlessHandler,
  setupZoomHandlers,
} from './events/miscHandlers.ts'
import {
  setupConwayHandler,
  setupMutateHandler,
  setupOutlierHandler,
  setupRandomRulesetHandler,
  setupSliderHandlers,
  setupStarHandler,
} from './events/rulesetHandlers.ts'
import {
  createResetPulseStarter,
  setupPlayPauseHandler,
  setupResetHandler,
  setupStepHandler,
  setupStepsPerSecondHandler,
} from './events/simulationHandlers.ts'
import { createHeader } from './header.ts'
import { createLeaderboardPanel } from './leaderboard.ts'
import { createPatternInspector } from './patternInspector.ts'
import { createProgressBar } from './progressBar.ts'
import { createRulesetPanel } from './ruleset.ts'
import { createSimulationPanel } from './simulation.ts'
import { createStatisticsPanel, renderStatistics } from './statistics.ts'
import { createStatsBar } from './statsBar.ts'
import { createSummaryPanel } from './summary.ts'
import { createTabContainer, type TabId } from './tabContainer.ts'
import { setupTheme } from './theme.ts'
import { handleCanvasClick } from './utils/canvasInteraction.ts'
import { renderRule } from './utils/ruleRenderer.ts'
import { updateStatisticsDisplay } from './utils/statsUpdater.ts'
import { createZoomSlider } from './zoomSlider.ts'

const GRID_ROWS = 400
const GRID_COLS = 400

// --- Types -----------------------------------------------------------------
type DisplayMode = 'orbits' | 'full'

// --- Color Management ------------------------------------------------------
// Colors are now managed by getCurrentThemeColors() from '../shared/theme.ts'
// (previously getCurrentColors(), now extracted to utils/colorUtils.ts)

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
        localStorage.getItem('sound-volume') || '15',
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
      localStorage.getItem('sound-volume') || '15',
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
    checkboxNewPatternOnReset,
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

  // Create ref objects for passing mutable state to event handlers
  const currentRulesetRef = {
    get value() {
      return currentRuleset
    },
    set value(v: C4Ruleset) {
      currentRuleset = v
    },
  }
  const initialConditionTypeRef = {
    get value() {
      return initialConditionType
    },
    set value(v: 'center' | 'random' | 'patch') {
      initialConditionType = v
    },
  }
  const displayModeRef = {
    get value() {
      return displayMode
    },
    set value(v: DisplayMode) {
      displayMode = v
    },
  }
  const statsUpdateIntervalRef = {
    get value() {
      return statsUpdateInterval
    },
    set value(v: number | null) {
      statsUpdateInterval = v
    },
  }
  const isStarredRef = {
    get value() {
      return isStarred
    },
    set value(v: boolean) {
      isStarred = v
    },
  }

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

  // Setup misc event handlers (benchmark, headless)
  setupBenchmarkHandler(btnBenchmark, () => benchmarkModal.show())
  setupHeadlessHandler(btnHeadless, () => {
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

  // Setup ruleset event handlers
  const rulesetHandlerDeps = {
    cellularAutomata,
    orbitLookup,
    ctx,
    ruleCanvas,
    ruleLabelDisplay,
    ruleIdDisplay,
    stepsPerSecondInput,
    orbitSlider,
    mutationSlider,
    displayMode: displayModeRef,
    currentRuleset: currentRulesetRef,
    isStarred: isStarredRef,
    updateStarButtonAppearance,
    applyInitialCondition,
  }

  setupStarHandler(btnStar, isStarredRef, updateStarButtonAppearance)
  setupConwayHandler(btnConway, rulesetHandlerDeps)
  setupOutlierHandler(btnOutlier, rulesetHandlerDeps)
  setupRandomRulesetHandler(btnRandomC4Ruleset, generateRandomPatternRule)
  setupMutateHandler(btnMutate, rulesetHandlerDeps)
  setupSliderHandlers(
    orbitSlider,
    orbitValue,
    mutationSlider,
    mutationValue,
    generateRandomPatternRule,
  )

  // Setup display mode handlers
  radioDisplayOrbits.checked = true
  const displayHandlerDeps = {
    currentRuleset: currentRulesetRef,
    orbitLookup,
    ctx,
    ruleCanvas,
    ruleLabelDisplay,
    ruleIdDisplay,
    displayMode: displayModeRef,
    applyInitialCondition,
    initialConditionType: initialConditionTypeRef,
  }

  setupDisplayModeHandlers(
    radioDisplayOrbits,
    radioDisplayFull,
    displayHandlerDeps,
  )
  setupSeedTypeHandlers(
    radioCenterSeed,
    radioRandomSeed,
    radioPatchSeed,
    displayHandlerDeps,
  )

  // Setup simulation control handlers
  const simulationHandlerDeps = {
    cellularAutomata,
    currentRuleset: currentRulesetRef,
    orbitLookup,
    stepsPerSecondInput,
    summaryPanel,
    progressBar,
    statsBar,
    audioEngine,
    statsUpdateInterval: statsUpdateIntervalRef,
    applyInitialCondition,
    initialConditionType: initialConditionTypeRef,
    initializeSimulationMetadata,
    updateURL,
    checkboxNewPatternOnReset,
  }

  setupStepHandler(btnStep, btnPlay, simulationHandlerDeps)
  setupResetHandler(btnReset, simulationHandlerDeps)
  const startResetPulse = createResetPulseStarter(btnReset)

  // Wire up died-out callback to pulse reset button
  onDiedOutCallback = startResetPulse

  setupPlayPauseHandler(btnPlay, simulationHandlerDeps)
  setupStepsPerSecondHandler(stepsPerSecondInput, simulationHandlerDeps)

  // Setup alive slider handler (needs to update display and applyInitialCondition)
  aliveSlider.addEventListener('input', () => {
    aliveValue.textContent = `${aliveSlider.value}%`
  })
  setupAliveSliderHandler(aliveSlider, applyInitialCondition)

  // Restore checkbox state from localStorage
  const savedCheckboxState = localStorage.getItem('new-pattern-on-reset')
  if (savedCheckboxState !== null) {
    checkboxNewPatternOnReset.checked = savedCheckboxState === 'true'
  }

  // Save checkbox state to localStorage when it changes
  checkboxNewPatternOnReset.addEventListener('change', () => {
    localStorage.setItem(
      'new-pattern-on-reset',
      String(checkboxNewPatternOnReset.checked),
    )
  })

  // Setup zoom handlers
  setupZoomHandlers(zoomSlider, cellularAutomata)

  // Setup export handlers
  const exportHandlerDeps = {
    cellularAutomata,
    currentRuleset: currentRulesetRef,
    summaryPanel,
  }

  setupJsonExportHandler(exportHandlerDeps)
  setupCsvExportHandler(exportHandlerDeps)

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
