import { CellularAutomata } from './cellular-automata.ts'
import { outlierRule } from './outlier-rule.ts'
import type { C4OrbitsData, C4Ruleset } from './schema.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  coords10x14,
  coords32x16,
  expandC4Ruleset,
  makeC4Ruleset,
  randomC4RulesetByDensity,
} from './utils.ts'

// Import components
import { createHeader, setupTheme } from './components/header.ts'
import { createRulesetPanel } from './components/ruleset.ts'
import { createSimulationPanel } from './components/simulation.ts'
import {
  type SummaryPanelElements,
  createSummaryPanel,
} from './components/summary.ts'

// --- Display Mode -----------------------------------------------------------
type DisplayMode = 'orbits' | 'full'

// --- Renderer --------------------------------------------------------------
function renderRule(
  ruleset: C4Ruleset,
  orbitLookup: Uint8Array,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ruleLabelDisplay: HTMLElement,
  ruleIdDisplay: HTMLElement,
  ruleLabel: string,
  displayMode: DisplayMode,
) {
  if (displayMode === 'orbits') {
    // Render 10×14 grid of C4 orbits
    const cols = 10
    const rows = 14
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    // Get colors from CSS variables
    const styles = getComputedStyle(document.documentElement)
    const bgColor = styles.getPropertyValue('--canvas-bg').trim()
    const fgColor = styles.getPropertyValue('--canvas-fg').trim()

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
    // Render 32×16 grid of full 512 patterns
    const cols = 32
    const rows = 16
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    // Get colors from CSS variables
    const styles = getComputedStyle(document.documentElement)
    const bgColor = styles.getPropertyValue('--canvas-bg').trim()
    const fgColor = styles.getPropertyValue('--canvas-fg').trim()

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

// --- Statistics Display ----------------------------------------------------
function updateStatisticsDisplay(
  cellularAutomata: CellularAutomata,
  elements: SummaryPanelElements,
) {
  const stats = cellularAutomata.getStatistics()
  const recentStats = stats.getRecentStats(1)
  const metadata = stats.getMetadata()

  if (recentStats.length === 0) return

  const current = recentStats[0]
  const interestScore = stats.calculateInterestScore()

  // Update simulation info
  if (metadata) {
    elements.simName.textContent = metadata.name
    elements.simRule.textContent = `${metadata.rulesetName} (${metadata.rulesetHex})`
    elements.simRule.title = `${metadata.rulesetName} (${metadata.rulesetHex})`

    let seedText = metadata.seedType
    if (metadata.seedPercentage !== undefined) {
      seedText += ` (${metadata.seedPercentage}%)`
    }
    elements.simSeed.textContent = seedText

    elements.simSteps.textContent = metadata.stepCount.toString()

    const elapsed = stats.getElapsedTime()
    const seconds = Math.floor(elapsed / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      elements.simTime.textContent = `${hours}h ${minutes % 60}m ${seconds % 60}s`
    } else if (minutes > 0) {
      elements.simTime.textContent = `${minutes}m ${seconds % 60}s`
    } else {
      elements.simTime.textContent = `${seconds}s`
    }

    const actualSps = stats.getActualStepsPerSecond()
    const requestedSps = metadata.requestedStepsPerSecond
    if (actualSps > 0) {
      let spsText = actualSps.toFixed(1)
      if (requestedSps) {
        spsText += ` / ${requestedSps}`
      }
      elements.simSps.textContent = spsText
    } else {
      elements.simSps.textContent = requestedSps
        ? `${requestedSps} (target)`
        : '—'
    }
  }

  // Update grid statistics
  elements.statPopulation.textContent = current.population.toFixed(0)
  elements.statActivity.textContent = current.activity.toFixed(0)
  elements.statEntropy2x2.textContent = current.entropy2x2.toFixed(2)
  elements.statEntropy4x4.textContent = current.entropy4x4.toFixed(2)
  elements.statEntropy8x8.textContent = current.entropy8x8.toFixed(2)
  elements.statInterest.textContent = `${(interestScore * 100).toFixed(1)}%`

  // Color code the interest score
  if (interestScore > 0.7) {
    elements.statInterest.className =
      'font-mono text-lg font-bold text-green-600 dark:text-green-400'
  } else if (interestScore > 0.4) {
    elements.statInterest.className =
      'font-mono text-lg font-bold text-yellow-600 dark:text-yellow-400'
  } else {
    elements.statInterest.className =
      'font-mono text-lg font-bold text-red-600 dark:text-red-400'
  }
}

// --- Canvas Click Handler --------------------------------------------------
function handleCanvasClick(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  currentRuleset: C4Ruleset,
  orbitsData: C4OrbitsData,
  orbitLookup: Uint8Array,
  displayMode: DisplayMode,
) {
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  if (displayMode === 'orbits') {
    // 10×14 orbit grid
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

    console.log(
      `\nOrbit ${orbitIndex} (output: ${output})\nRepresentative pattern:\n${bits[0]} ${bits[1]} ${bits[2]}\n${bits[3]} ${bits[4]} ${bits[5]}     --->  ${output}\n${bits[6]} ${bits[7]} ${bits[8]}\n`,
    )
    console.log(`Stabilizer: ${orbit.stabilizer}, Size: ${orbit.size}`)
  } else {
    // 32×16 full pattern grid
    const cols = 32
    const rows = 16
    const cellW = canvas.width / cols
    const cellH = canvas.height / rows

    const gridX = Math.floor(x / cellW)
    const gridY = Math.floor(y / cellH)

    // Find pattern index from coordinates using inverse of coords32x16
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

    console.log(
      `\nPattern ${patternIndex} (orbit: ${orbitId}, output: ${output})\n${bits[0]} ${bits[1]} ${bits[2]}\n${bits[3]} ${bits[4]} ${bits[5]}     --->  ${output}\n${bits[6]} ${bits[7]} ${bits[8]}\n`,
    )
  }
}

// --- Main ------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app') as HTMLDivElement

  // Create header with theme toggle and GitHub link
  const header = createHeader()
  appRoot.appendChild(header.root)

  // Create main content container
  const mainContent = document.createElement('main')
  mainContent.className =
    'flex-1 flex items-center justify-center gap-6 p-6 lg:p-12'

  // Create main layout container
  const mainContainer = document.createElement('div')
  mainContainer.className =
    'flex flex-col lg:flex-row items-start justify-center gap-12 w-full max-w-7xl'

  // Create left column (simulation + summary)
  const leftColumn = document.createElement('div')
  leftColumn.className = 'flex flex-col items-center gap-3'

  const simulationPanel = createSimulationPanel()
  const summaryPanel = createSummaryPanel()
  leftColumn.appendChild(simulationPanel.root)
  leftColumn.appendChild(summaryPanel.root)

  // Create right column (ruleset)
  const rulesetPanel = createRulesetPanel()

  // Assemble layout
  mainContainer.appendChild(leftColumn)
  mainContainer.appendChild(rulesetPanel.root)
  mainContent.appendChild(mainContainer)
  appRoot.appendChild(mainContent)

  // Extract elements for easier access
  const {
    canvas: simCanvas,
    btnStep,
    btnReset,
    btnPlay,
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

  // Initialize cellular automata simulation
  const cellularAutomata = new CellularAutomata(simCanvas)

  // Initialize statistics display
  updateStatisticsDisplay(cellularAutomata, summaryPanel.elements)

  // Track current ruleset for click handler
  let currentRuleset: C4Ruleset

  // Track current initial condition selection
  let initialConditionType: 'center' | 'random' | 'patch' = 'patch'

  // Track current display mode
  let displayMode: DisplayMode = 'orbits'

  // Function to apply the selected initial condition
  function applyInitialCondition() {
    if (initialConditionType === 'center') {
      cellularAutomata.centerSeed()
    } else if (initialConditionType === 'patch') {
      const percentage = Number.parseInt(aliveSlider.value)
      cellularAutomata.patchSeed(percentage)
    } else {
      const percentage = Number.parseInt(aliveSlider.value)
      cellularAutomata.randomSeed(percentage)
    }
    cellularAutomata.render()
    updateStatisticsDisplay(cellularAutomata, summaryPanel.elements)

    // Initialize simulation metadata
    initializeSimulationMetadata()
  }

  // Function to initialize simulation metadata
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

  // Apply the initial patch seed
  applyInitialCondition()

  // Default: Conway
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
  )

  // Setup theme with re-render callback
  setupTheme(header.elements.themeToggle, () => {
    // Re-render canvases when theme changes
    cellularAutomata.render()
    updateStatisticsDisplay(cellularAutomata, summaryPanel.elements)
    renderRule(
      currentRuleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      ruleLabelDisplay.textContent || 'Loading...',
      displayMode,
    )
  })

  // Add click listener to ruleset canvas
  ruleCanvas.addEventListener('click', (e) => {
    handleCanvasClick(
      e,
      ruleCanvas,
      currentRuleset,
      orbitsData,
      orbitLookup,
      displayMode,
    )
  })
  ruleCanvas.style.cursor = 'pointer'

  // --- Event Listeners -------------------------------------------------------

  // Conway button
  btnConway.addEventListener('click', () => {
    const ruleset = makeC4Ruleset(conwayRule, orbitLookup)
    currentRuleset = ruleset
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      'Conway',
      displayMode,
    )

    applyInitialCondition()

    // If playing, restart with new rules
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  })

  // Outlier button
  btnOutlier.addEventListener('click', () => {
    const ruleset = makeC4Ruleset(outlierRule, orbitLookup)
    currentRuleset = ruleset
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      'Outlier',
      displayMode,
    )

    applyInitialCondition()

    // If playing, restart with new rules
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  })

  // Random pattern button generates a new rule
  btnRandomC4Ruleset.addEventListener('click', () => {
    generateRandomPatternRule()
  })

  // Update orbit slider value display and regenerate rule
  orbitSlider.addEventListener('input', () => {
    orbitValue.textContent = `${orbitSlider.value}%`
    generateRandomPatternRule()
  })

  function generateRandomPatternRule() {
    const percentage = Number.parseInt(orbitSlider.value)
    const density = percentage / 100
    const ruleset = randomC4RulesetByDensity(density)
    currentRuleset = ruleset
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      ruleCanvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      `Random Pattern (${percentage}% orbits)`,
      displayMode,
    )

    applyInitialCondition()

    // If playing, restart with new rules
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  }

  // Display mode radio buttons
  radioDisplayOrbits.checked = true

  radioDisplayOrbits.addEventListener('change', () => {
    if (radioDisplayOrbits.checked) {
      displayMode = 'orbits'
      renderRule(
        currentRuleset,
        orbitLookup,
        ctx,
        ruleCanvas,
        ruleLabelDisplay,
        ruleIdDisplay,
        ruleLabelDisplay.textContent || 'Loading...',
        displayMode,
      )
    }
  })

  radioDisplayFull.addEventListener('change', () => {
    if (radioDisplayFull.checked) {
      displayMode = 'full'
      renderRule(
        currentRuleset,
        orbitLookup,
        ctx,
        ruleCanvas,
        ruleLabelDisplay,
        ruleIdDisplay,
        ruleLabelDisplay.textContent || 'Loading...',
        displayMode,
      )
    }
  })

  // Initial condition radio buttons
  radioCenterSeed.addEventListener('change', () => {
    if (radioCenterSeed.checked) {
      initialConditionType = 'center'
      applyInitialCondition()
    }
  })

  radioRandomSeed.addEventListener('change', () => {
    if (radioRandomSeed.checked) {
      initialConditionType = 'random'
      applyInitialCondition()
    }
  })

  radioPatchSeed.addEventListener('change', () => {
    if (radioPatchSeed.checked) {
      initialConditionType = 'patch'
      applyInitialCondition()
    }
  })

  // Simulation buttons
  btnStep.addEventListener('click', () => {
    const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
    cellularAutomata.step(expanded)
    updateStatisticsDisplay(cellularAutomata, summaryPanel.elements)
  })

  btnReset.addEventListener('click', () => {
    applyInitialCondition()
  })

  // Update statistics periodically when playing
  let statsUpdateInterval: number | null = null

  btnPlay.addEventListener('click', () => {
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

      // Update metadata with requested SPS
      const stats = cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      if (metadata) {
        metadata.requestedStepsPerSecond = stepsPerSecond
      }

      // Update statistics display periodically
      statsUpdateInterval = window.setInterval(() => {
        updateStatisticsDisplay(cellularAutomata, summaryPanel.elements)
      }, 100)
    }
  })

  // Update play speed when input changes
  stepsPerSecondInput.addEventListener('change', () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      if (statsUpdateInterval !== null) {
        clearInterval(statsUpdateInterval)
      }
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)

      // Update metadata with new requested SPS
      const stats = cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      if (metadata) {
        metadata.requestedStepsPerSecond = stepsPerSecond
      }

      statsUpdateInterval = window.setInterval(() => {
        updateStatisticsDisplay(cellularAutomata, summaryPanel.elements)
      }, 100)
    }
  })

  // Update alive slider value display
  aliveSlider.addEventListener('input', () => {
    aliveValue.textContent = `${aliveSlider.value}%`
    // If random seed or patch seed is selected, update the grid
    if (initialConditionType === 'random' || initialConditionType === 'patch') {
      applyInitialCondition()
    }
  })
})
