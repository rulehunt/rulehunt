#!/usr/bin/env node

/**
 * Test script to verify CA factory selection logic
 *
 * Tests:
 * 1. Mobile layout (wide viewport) - should use GPU for ~600K cells
 * 2. Mobile layout (narrow viewport) - should use CPU for smaller grids
 * 3. Desktop layout - currently uses CPU directly
 */

import puppeteer from 'puppeteer'

const URL = 'http://localhost:3000'
const TIMEOUT = 10000

async function captureConsoleLogs(viewport, expectedImplementation) {
  const browser = await puppeteer.launch({ headless: 'new' })
  const page = await browser.newPage()

  // Set viewport
  await page.setViewport(viewport)

  // Collect console logs
  const logs = []
  page.on('console', msg => {
    const text = msg.text()
    logs.push(text)
    console.log(`[${viewport.width}x${viewport.height}] ${text}`)
  })

  // Navigate and wait for CA initialization
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT })

  // Wait for layout initialization
  await new Promise(resolve => setTimeout(resolve, 3000))

  // Check for factory logs
  const factoryLog = logs.find(log => log.includes('[CA Factory]'))

  await browser.close()

  return {
    viewport,
    logs,
    factoryLog,
    success: factoryLog && factoryLog.includes(expectedImplementation)
  }
}

async function runTests() {
  console.log('='.repeat(80))
  console.log('Testing CA Factory Selection Logic')
  console.log('='.repeat(80))

  const tests = [
    {
      name: 'Mobile (narrow - 500x900)',
      viewport: { width: 500, height: 900 },
      expected: 'GPU', // Mobile with larger grid should use GPU
    },
    {
      name: 'Mobile (small - 375x667)',
      viewport: { width: 375, height: 667 },
      expected: 'CPU', // Smaller mobile grid might use CPU
    },
    {
      name: 'Desktop (1920x1080)',
      viewport: { width: 1920, height: 1080 },
      expected: 'CPU', // Desktop currently uses CPU directly (no factory yet)
    }
  ]

  const results = []

  for (const test of tests) {
    console.log(`\n${'='.repeat(80)}`)
    console.log(`Test: ${test.name}`)
    console.log(`Expected: ${test.expected}`)
    console.log('-'.repeat(80))

    const result = await captureConsoleLogs(test.viewport, test.expected)
    results.push({ ...test, ...result })

    console.log('-'.repeat(80))
    console.log(`Factory Log: ${result.factoryLog || 'NOT FOUND'}`)
    console.log(`Status: ${result.success ? '✅ PASS' : '❌ FAIL'}`)
  }

  // Summary
  console.log('\n' + '='.repeat(80))
  console.log('SUMMARY')
  console.log('='.repeat(80))

  results.forEach(r => {
    const status = r.success ? '✅' : '❌'
    console.log(`${status} ${r.name}: Expected ${r.expected}, Got: ${r.factoryLog || 'NO LOG'}`)
  })

  const allPassed = results.every(r => r.success)
  console.log('\n' + (allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'))

  process.exit(allPassed ? 0 : 1)
}

runTests().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
})
