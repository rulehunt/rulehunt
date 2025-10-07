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
function updateStatisticsDisplay(cellularAutomata: CellularAutomata) {
  const stats = cellularAutomata.getStatistics()
  const recentStats = stats.getRecentStats(1)

  if (recentStats.length === 0) return

  const current = recentStats[0]
  const interestScore = stats.calculateInterestScore()

  // Update text displays
  const populationEl = document.getElementById('stat-population')
  const activityEl = document.getElementById('stat-activity')
  const entropy2x2El = document.getElementById('stat-entropy-2x2')
  const entropy4x4El = document.getElementById('stat-entropy-4x4')
  const entropy8x8El = document.getElementById('stat-entropy-8x8')
  const interestEl = document.getElementById('stat-interest')

  if (populationEl) populationEl.textContent = current.population.toFixed(0)
  if (activityEl) activityEl.textContent = current.activity.toFixed(0)
  if (entropy2x2El) entropy2x2El.textContent = current.entropy2x2.toFixed(2)
  if (entropy4x4El) entropy4x4El.textContent = current.entropy4x4.toFixed(2)
  if (entropy8x8El) entropy8x8El.textContent = current.entropy8x8.toFixed(2)
  if (interestEl) {
    interestEl.textContent = (interestScore * 100).toFixed(1) + '%'
    // Color code the interest score
    if (interestScore > 0.7) {
      interestEl.className = 'font-mono text-green-600 dark:text-green-400'
    } else if (interestScore > 0.4) {
      interestEl.className = 'font-mono text-yellow-600 dark:text-yellow-400'
    } else {
      interestEl.className = 'font-mono text-red-600 dark:text-red-400'
    }
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
  // Theme Management
  const themeLight = document.getElementById('theme-light') as HTMLButtonElement
  const themeDark = document.getElementById('theme-dark') as HTMLButtonElement
  const themeSystem = document.getElementById(
    'theme-system',
  ) as HTMLButtonElement

  function setTheme(theme: 'light' | 'dark' | 'system') {
    localStorage.setItem('theme', theme)

    // Update button styles
    const baseClasses = 'px-3 py-1 rounded text-sm transition-colors'
    const activeClasses = `${baseClasses} bg-blue-500 text-white`
    const inactiveClasses = `${baseClasses} hover:bg-gray-200 dark:hover:bg-gray-700`

    themeLight.className = theme === 'light' ? activeClasses : inactiveClasses
    themeDark.className = theme === 'dark' ? activeClasses : inactiveClasses
    themeSystem.className = theme === 'system' ? activeClasses : inactiveClasses

    if (theme === 'system') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      document.documentElement.classList.toggle('dark', isDark)
    } else {
      document.documentElement.classList.toggle('dark', theme === 'dark')
    }

    // Re-render canvases with new colors (only if they exist)
    try {
      if (typeof cellularAutomata !== 'undefined' && cellularAutomata) {
        cellularAutomata.render()
        updateStatisticsDisplay(cellularAutomata)
      }
      if (typeof currentRuleset !== 'undefined' && currentRuleset) {
        renderRule(
          currentRuleset,
          orbitLookup,
          ctx,
          canvas,
          ruleLabelDisplay,
          ruleIdDisplay,
          ruleLabelDisplay.textContent || 'Loading...',
          displayMode,
        )
      }
    } catch (e) {
      // Variables not initialized yet - will use correct theme when first rendered
    }
  }

  themeLight.addEventListener('click', () => setTheme('light'))
  themeDark.addEventListener('click', () => setTheme('dark'))
  themeSystem.addEventListener('click', () => setTheme('system'))

  // Initialize theme
  const savedTheme = localStorage.getItem('theme') as
    | 'light'
    | 'dark'
    | 'system'
    | null
  setTheme(savedTheme || 'system')

  // Listen for system theme changes
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (localStorage.getItem('theme') === 'system') {
        setTheme('system')
      }
    })

  const ruleLabelDisplay = document.getElementById('rule-label') as HTMLElement
  const ruleIdDisplay = document.getElementById('rule-id') as HTMLElement

  const canvas = document.getElementById('truth') as HTMLCanvasElement
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D

  // Load orbit data
  const response = await fetch('./resources/c4-orbits.json')
  const orbitsData: C4OrbitsData = await response.json()
  const orbitLookup = buildOrbitLookup(orbitsData)

  console.log(`Loaded ${orbitsData.orbits.length} C4 orbits`)

  // Initialize cellular automata simulation
  const simCanvas = document.getElementById('simulation') as HTMLCanvasElement
  const cellularAutomata = new CellularAutomata(simCanvas)

  // Initialize statistics display
  updateStatisticsDisplay(cellularAutomata)

  // Track current ruleset for click handler
  let currentRuleset: C4Ruleset

  // Track current initial condition selection
  let initialConditionType: 'center' | 'random' | 'patch' = 'patch'

  // Track current display mode
  let displayMode: DisplayMode = 'orbits'

  // Get slider early so we can use it in applyInitialCondition
  const aliveSlider = document.getElementById(
    'alive-slider',
  ) as HTMLInputElement

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
    updateStatisticsDisplay(cellularAutomata)
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
    canvas,
    ruleLabelDisplay,
    ruleIdDisplay,
    'Conway',
    displayMode,
  )

  // Add click listener
  canvas.addEventListener('click', (e) => {
    handleCanvasClick(
      e,
      canvas,
      currentRuleset,
      orbitsData,
      orbitLookup,
      displayMode,
    )
  })
  canvas.style.cursor = 'pointer'

  // Buttons
  const btnConway = document.getElementById('btn-conway') as HTMLButtonElement
  const btnOutlier = document.getElementById('btn-outlier') as HTMLButtonElement
  const btnRandomC4Ruleset = document.getElementById(
    'btn-random-c4-ruleset',
  ) as HTMLButtonElement

  // Orbit slider elements
  const orbitSlider = document.getElementById(
    'orbit-slider',
  ) as HTMLInputElement
  const orbitValue = document.getElementById('orbit-value') as HTMLButtonElement

  btnConway.addEventListener('click', () => {
    const ruleset = makeC4Ruleset(conwayRule, orbitLookup)
    currentRuleset = ruleset
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      canvas,
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

  btnOutlier.addEventListener('click', () => {
    const ruleset = makeC4Ruleset(outlierRule, orbitLookup)
    currentRuleset = ruleset
    renderRule(
      ruleset,
      orbitLookup,
      ctx,
      canvas,
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
      canvas,
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
  const radioDisplayOrbits = document.getElementById(
    'radio-display-orbits',
  ) as HTMLInputElement
  const radioDisplayFull = document.getElementById(
    'radio-display-full',
  ) as HTMLInputElement

  radioDisplayOrbits.checked = true

  radioDisplayOrbits.addEventListener('change', () => {
    if (radioDisplayOrbits.checked) {
      displayMode = 'orbits'
      // Re-render current ruleset with new display mode
      renderRule(
        currentRuleset,
        orbitLookup,
        ctx,
        canvas,
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
      // Re-render current ruleset with new display mode
      renderRule(
        currentRuleset,
        orbitLookup,
        ctx,
        canvas,
        ruleLabelDisplay,
        ruleIdDisplay,
        ruleLabelDisplay.textContent || 'Loading...',
        displayMode,
      )
    }
  })

  // Initial condition radio buttons
  const radioCenterSeed = document.getElementById(
    'radio-center-seed',
  ) as HTMLInputElement
  const radioRandomSeed = document.getElementById(
    'radio-random-seed',
  ) as HTMLInputElement
  const radioPatchSeed = document.getElementById(
    'radio-patch-seed',
  ) as HTMLInputElement

  // Listen for radio button changes
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
  const btnStep = document.getElementById('btn-step') as HTMLButtonElement
  const btnRestart = document.getElementById('btn-reset') as HTMLButtonElement

  const btnPlay = document.getElementById('btn-play') as HTMLButtonElement

  const aliveValue = document.getElementById('alive-value') as HTMLButtonElement
  const stepsPerSecondInput = document.getElementById(
    'steps-per-second',
  ) as HTMLInputElement

  // Update slider value display
  aliveSlider.addEventListener('input', () => {
    aliveValue.textContent = `${aliveSlider.value}%`
    // If random seed or patch seed is selected, update the grid
    if (initialConditionType === 'random' || initialConditionType === 'patch') {
      applyInitialCondition()
    }
  })

  btnStep.addEventListener('click', () => {
    const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
    cellularAutomata.step(expanded)
    updateStatisticsDisplay(cellularAutomata)
  })

  btnRestart.addEventListener('click', () => {
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

      // Update statistics display periodically
      statsUpdateInterval = window.setInterval(() => {
        updateStatisticsDisplay(cellularAutomata)
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

      statsUpdateInterval = window.setInterval(() => {
        updateStatisticsDisplay(cellularAutomata)
      }, 100)
    }
  })
})
