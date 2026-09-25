import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
})

const page = await browser.newPage()

const stepTimes = []
const interestScores = []
let rounds = 0
const roundSummaries = [] // Track per-round performance summaries

// Capture all console logs for debugging
page.on('console', (msg) => {
  const text = msg.text()

  // Track step performance
  if (text.includes('[Perf] Step')) {
    const timeMatch = text.match(/([\d.]+)ms/)
    if (timeMatch) {
      stepTimes.push(Number.parseFloat(timeMatch[1]))
    }
  }

  // Track rounds and interest scores
  if (text.includes('[DataMode] Round')) {
    if (text.includes('complete')) {
      rounds++
      const scoreMatch = text.match(/score: ([\d.]+)/)
      if (scoreMatch) {
        interestScores.push(Number.parseFloat(scoreMatch[1]))
      }
    }
    console.log(text)
  }

  // Track round summaries
  if (text.includes('[Perf] Round') && text.includes('summary:')) {
    const match = text.match(
      /Round (\d+) summary: avg=([\d.]+)ms p50=([\d.]+)ms p90=([\d.]+)ms p99=([\d.]+)ms/,
    )
    if (match) {
      roundSummaries.push({
        round: Number.parseInt(match[1], 10),
        avg: Number.parseFloat(match[2]),
        p50: Number.parseFloat(match[3]),
        p90: Number.parseFloat(match[4]),
        p99: Number.parseFloat(match[5]),
      })
    }
  }

  // Debug: Print all DataMode, Benchmark, Perf, and PerfDetail logs
  if (
    text.includes('[DataMode]') ||
    text.includes('[Benchmark]') ||
    text.includes('[Perf]') ||
    text.includes('[PerfDetail]')
  ) {
    console.log(text)
  }
})

// Capture page errors
page.on('pageerror', (error) => {
  console.error('[Page Error]', error.message)
})

page.on('error', (error) => {
  console.error('[Error]', error.message)
})

// Navigate directly to data mode
console.log('\n[Benchmark] Loading data mode...')
await page.goto('http://localhost:3000/?dataMode=true', {
  waitUntil: 'domcontentloaded',
  timeout: 10000,
})

console.log('[Benchmark] Waiting for data mode to initialize...')
await new Promise((resolve) => setTimeout(resolve, 3000))

// Let it run for 15 seconds to collect detailed breakdown
console.log(
  '[Benchmark] Running for 15 seconds to collect performance data...\n',
)
await new Promise((resolve) => setTimeout(resolve, 15000))

console.log('\n[Benchmark] Stopping benchmark...')

// Print comprehensive analysis
console.log(`\n${'='.repeat(80)}`)
console.log('DATA MODE PERFORMANCE BENCHMARK - POST PHASE 2 OPTIMIZATIONS')
console.log('='.repeat(80))

console.log('\n📊 Overall Performance:')
console.log(`  Rounds completed: ${rounds}`)
console.log(`  Steps sampled: ${stepTimes.length}`)

if (stepTimes.length > 0) {
  const avgStep = stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length
  const minStep = Math.min(...stepTimes)
  const maxStep = Math.max(...stepTimes)
  const actualSPS = 1000 / avgStep

  console.log('\n⚙️  Step Performance (CA + Statistics):')
  console.log(`  Average: ${avgStep.toFixed(2)}ms`)
  console.log(`  Min: ${minStep.toFixed(2)}ms`)
  console.log(`  Max: ${maxStep.toFixed(2)}ms`)
  console.log(`  Actual SPS: ${actualSPS.toFixed(1)} steps/second`)
  console.log(`  Estimated max throughput: ${actualSPS.toFixed(0)} SPS`)
}

if (interestScores.length > 0) {
  const avgInterest =
    interestScores.reduce((a, b) => a + b, 0) / interestScores.length
  const minInterest = Math.min(...interestScores)
  const maxInterest = Math.max(...interestScores)

  console.log('\n✨ Interest Score Quality:')
  console.log(`  Average: ${avgInterest.toFixed(3)}`)
  console.log(`  Min: ${minInterest.toFixed(3)}`)
  console.log(`  Max: ${maxInterest.toFixed(3)}`)
  console.log(`  Range: ${(maxInterest - minInterest).toFixed(3)}`)
}

console.log('\n📈 Per-Round Performance:')
if (roundSummaries.length > 0) {
  for (const summary of roundSummaries) {
    const sps = 1000 / summary.avg
    console.log(
      `  Round ${summary.round}: avg=${summary.avg.toFixed(1)}ms p50=${summary.p50.toFixed(1)}ms p90=${summary.p90.toFixed(1)}ms → ${sps.toFixed(0)} SPS`,
    )
  }

  // Calculate average across rounds (excluding warmup round 1)
  const steadyStateRounds = roundSummaries.slice(1)
  if (steadyStateRounds.length > 0) {
    const avgMedian =
      steadyStateRounds.reduce((sum, r) => sum + r.p50, 0) /
      steadyStateRounds.length
    const steadyStateSPS = 1000 / avgMedian
    console.log(
      `\n  Steady-state median: ${avgMedian.toFixed(1)}ms → ${steadyStateSPS.toFixed(0)} SPS`,
    )
  }
}

console.log('\n📊 Optimization Progress:')
console.log('  Baseline (pre-optimization):     ~20ms/step → 50 SPS')
console.log('  Phase 1 (sampling):              ~12ms/step → 83 SPS')
console.log(
  '  Phase 1+2 (sparse entropy):      ~7-8ms/step → 125-140 SPS (expected)',
)
if (roundSummaries.length > 1) {
  const steadyStateRounds = roundSummaries.slice(1)
  const avgMedian =
    steadyStateRounds.reduce((sum, r) => sum + r.p50, 0) /
    steadyStateRounds.length
  const actualSPS = 1000 / avgMedian
  const improvement = (actualSPS / 50).toFixed(1)
  console.log(
    `  Actual (measured):               ~${avgMedian.toFixed(1)}ms/step → ${actualSPS.toFixed(0)} SPS (${improvement}x)`,
  )
}

console.log('\n💡 Next Steps:')
if (stepTimes.length > 0) {
  const avgStep = stepTimes.reduce((a, b) => a + b, 0) / stepTimes.length
  const actualSPS = 1000 / avgStep

  if (actualSPS < 100) {
    console.log('  ⚠️  Performance below target - investigate further')
  } else if (actualSPS < 150) {
    console.log(
      '  ✅ Good performance - consider if further optimization needed',
    )
    console.log('  → Profile CA computation vs statistics breakdown')
    console.log('  → WebGPU if 200+ SPS target required')
  } else {
    console.log('  ✅ Excellent performance achieved!')
    console.log('  → Monitor in production')
    console.log('  → WebGPU only if 500+ SPS needed')
  }
}

console.log(`\n${'='.repeat(80)}\n`)

await browser.close()
