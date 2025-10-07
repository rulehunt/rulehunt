import { CellularAutomata } from './cellular-automata.ts'
import type { C4OrbitsData, C4Ruleset } from './schema.ts'
import {
  buildOrbitLookup,
  c4RulesetToHex,
  conwayRule,
  coords10x14,
  expandC4Ruleset,
  makeC4Ruleset,
  outlierRule,
  randomC4RulesetByDensity,
} from './utils.ts'

// --- Renderer --------------------------------------------------------------
function renderRule(
  ruleset: C4Ruleset,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  ruleLabelDisplay: HTMLElement,
  ruleIdDisplay: HTMLElement,
  ruleLabel: string,
) {
  const cols = 10
  const rows = 14
  const cellW = canvas.width / cols
  const cellH = canvas.height / rows

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = 'purple'

  // Render the 140 orbit representatives
  for (let orbit = 0; orbit < 140; orbit++) {
    if (ruleset[orbit]) {
      const { x, y } = coords10x14(orbit)
      ctx.fillRect(x * cellW, y * cellH, cellW, cellH)
    }
  }

  const hex35 = c4RulesetToHex(ruleset)
  ruleLabelDisplay.textContent = `${ruleLabel}`
  ruleIdDisplay.textContent = `${hex35}`
}

// --- Canvas Click Handler --------------------------------------------------
function handleCanvasClick(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  currentRuleset: C4Ruleset,
  orbitsData: C4OrbitsData,
) {
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top

  const cols = 10
  const rows = 14
  const cellW = canvas.width / cols
  const cellH = canvas.height / rows

  const gridX = Math.floor(x / cellW)
  const gridY = Math.floor(y / cellH)

  // Convert grid position to orbit index
  const orbitIndex = gridY * cols + gridX

  if (orbitIndex < 0 || orbitIndex >= 140) return

  // Get the orbit data
  const orbit = orbitsData.orbits[orbitIndex]
  const output = currentRuleset[orbitIndex]

  // Use the representative pattern from the orbit
  const representative = orbit.representative

  // Extract the 3x3 pattern from the 9-bit index
  const bits = []
  for (let i = 0; i < 9; i++) {
    bits.push((representative >> i) & 1)
  }

  console.log(
    `\nOrbit ${orbitIndex} (output: ${output})\nRepresentative pattern:\n${bits[0]} ${bits[1]} ${bits[2]}\n${bits[3]} ${bits[4]} ${bits[5]}     --->  ${output}\n${bits[6]} ${bits[7]} ${bits[8]}\n`,
  )
  console.log(`Stabilizer: ${orbit.stabilizer}, Size: ${orbit.size}`)
}

// --- Main ------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  const ruleLabelDisplay = document.getElementById('rulename') as HTMLElement
  const ruleIdDisplay = document.getElementById('ruleid') as HTMLElement
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

  // Track current ruleset for click handler
  let currentRuleset: C4Ruleset

  // Track current initial condition selection
  let initialConditionType: 'center' | 'random' | 'patch' = 'patch'

  // Default: Conway
  const conwayRuleset = makeC4Ruleset(conwayRule, orbitLookup)
  currentRuleset = conwayRuleset
  renderRule(
    conwayRuleset,
    ctx,
    canvas,
    ruleLabelDisplay,
    ruleIdDisplay,
    'Conway',
  )

  // Add click listener
  canvas.addEventListener('click', (e) => {
    handleCanvasClick(e, canvas, currentRuleset, orbitsData)
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
    renderRule(ruleset, ctx, canvas, ruleLabelDisplay, ruleIdDisplay, 'Conway')

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
    renderRule(ruleset, ctx, canvas, ruleLabelDisplay, ruleIdDisplay, 'Outlier')

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
      ctx,
      canvas,
      ruleLabelDisplay,
      ruleIdDisplay,
      `Random Pattern (${percentage}% orbits)`,
    )

    // If playing, restart with new rules
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  }

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
  }

  // Simulation buttons
  const btnStep = document.getElementById('btn-step') as HTMLButtonElement
  const btnRestart = document.getElementById('btn-restart') as HTMLButtonElement

  const btnPlay = document.getElementById('btn-play') as HTMLButtonElement
  const aliveSlider = document.getElementById(
    'alive-slider',
  ) as HTMLInputElement
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
  })

  btnRestart.addEventListener('click', () => {
    applyInitialCondition()
  })

  btnPlay.addEventListener('click', () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      btnPlay.textContent = 'Play'
    } else {
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
      btnPlay.textContent = 'Pause'
    }
  })

  // Update play speed when input changes
  stepsPerSecondInput.addEventListener('change', () => {
    if (cellularAutomata.isCurrentlyPlaying()) {
      cellularAutomata.pause()
      const stepsPerSecond = Number.parseInt(stepsPerSecondInput.value)
      const expanded = expandC4Ruleset(currentRuleset, orbitLookup)
      cellularAutomata.play(stepsPerSecond, expanded)
    }
  })
})
