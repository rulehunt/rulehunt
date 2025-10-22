// src/components/desktop/events/exportHandlers.ts

import type { CellularAutomata } from '../../../cellular-automata-cpu.ts'
import type { C4Ruleset } from '../../../schema.ts'
import { c4RulesetToHex } from '../../../utils.ts'
import type { SummaryPanelElements } from '../summary.ts'

export interface ExportHandlerDeps {
  cellularAutomata: CellularAutomata
  currentRuleset: { value: C4Ruleset }
  summaryPanel: { elements: SummaryPanelElements }
}

/**
 * Setup handler for JSON export button
 */
export function setupJsonExportHandler(deps: ExportHandlerDeps) {
  deps.summaryPanel.elements.copyJsonButton.addEventListener(
    'click',
    async () => {
      const stats = deps.cellularAutomata.getStatistics()
      const metadata = stats.getMetadata()
      const recent = stats.getRecentStats(1)[0]
      const interestScore = stats.calculateInterestScore()

      const exportData = {
        rulesetName: metadata?.rulesetName ?? 'Unknown',
        rulesetHex: c4RulesetToHex(deps.currentRuleset.value),
        seed: deps.cellularAutomata.getSeed(),
        seedType: metadata?.seedType,
        seedPercentage: metadata?.seedPercentage,
        stepCount: metadata?.stepCount ?? 0,
        elapsedTime: stats.getElapsedTime(),
        actualSps: stats.getActualStepsPerSecond(),
        requestedSps: metadata?.requestedStepsPerSecond,
        gridSize: deps.cellularAutomata.getGridSize(),
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
        const btn = deps.summaryPanel.elements.copyJsonButton
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
    },
  )
}

/**
 * Setup handler for CSV export button
 */
export function setupCsvExportHandler(deps: ExportHandlerDeps) {
  deps.summaryPanel.elements.exportCsvButton.addEventListener('click', () => {
    const stats = deps.cellularAutomata.getStatistics()
    const metadata = stats.getMetadata()
    const recent = stats.getRecentStats(1)[0]
    const interestScore = stats.calculateInterestScore()

    const csvData = [
      ['Field', 'Value'],
      ['Ruleset Name', metadata?.rulesetName ?? 'Unknown'],
      ['Ruleset Hex', c4RulesetToHex(deps.currentRuleset.value)],
      ['Seed', deps.cellularAutomata.getSeed().toString()],
      ['Seed Type', metadata?.seedType ?? ''],
      ['Seed Percentage', metadata?.seedPercentage?.toString() ?? ''],
      ['Step Count', (metadata?.stepCount ?? 0).toString()],
      ['Elapsed Time (ms)', stats.getElapsedTime().toString()],
      ['Actual SPS', stats.getActualStepsPerSecond().toFixed(2)],
      ['Requested SPS', metadata?.requestedStepsPerSecond?.toString() ?? ''],
      ['Grid Size', deps.cellularAutomata.getGridSize().toString()],
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

    const csvContent = csvData.map((row) => row.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `simulation-${Date.now()}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}
