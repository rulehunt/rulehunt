// src/components/desktop/research.ts

/**
 * Research panel — access to the RuleHunt exploration dataset.
 *
 * The panel root is a vertical stack of self-contained "sections" (cards).
 * Today it holds a single section (the database export); additional sections
 * (e.g. corpus-wide aggregate statistics) can be appended to
 * `elements.sections` without restructuring this component.
 */

export interface ResearchPanelElements {
  /** Vertical stack that holds each research section. Append new sections here. */
  sections: HTMLDivElement
  /** Anchor pointing at the CSV export endpoint. */
  downloadButton: HTMLAnchorElement
}

/** Endpoint implemented by `functions/api/export-database.ts`. */
export const EXPORT_DATABASE_PATH = '/api/export-database'

export function createResearchPanel(): {
  root: HTMLDivElement
  elements: ResearchPanelElements
} {
  const root = document.createElement('div')
  root.className = 'flex flex-col items-center gap-3 w-full'

  const sections = document.createElement('div')
  sections.className = 'w-full max-w-4xl flex flex-col gap-6'

  const exportSection = document.createElement('section')
  exportSection.className =
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 p-6'
  exportSection.setAttribute('aria-labelledby', 'research-export-heading')

  exportSection.innerHTML = `
    <h2 id="research-export-heading" class="text-2xl font-bold text-gray-900 dark:text-white">
      🔬 Research Data Export
    </h2>

    <p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
      Download the complete RuleHunt exploration dataset — one row per submitted
      simulation run — as a single CSV file for offline analysis.
    </p>

    <a
      id="research-download"
      href="${EXPORT_DATABASE_PATH}"
      download="rulehunt-export.csv"
      class="mt-5 inline-flex items-center justify-center gap-2 px-6 py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-semibold transition-colors"
    >
      ⬇️ Download Full Database (CSV)
    </a>

    <div class="mt-6 text-sm text-gray-600 dark:text-gray-400">
      <p class="font-semibold text-gray-900 dark:text-gray-200 mb-2">Each row includes:</p>
      <ul class="list-disc list-inside ml-2 space-y-1">
        <li>Submission info (run id, timestamp, user id and optional label)</li>
        <li>Ruleset identity (name, 35-character hex encoding)</li>
        <li>Seed and simulation settings (seed, seed type, seed percentage, grid size)</li>
        <li>Step and timing metadata (step count, watched steps and wall time, requested and actual steps/sec)</li>
        <li>Aggregated statistics (population, activity, population change, 2×2/4×4/8×8 entropy, interest score)</li>
        <li>Entity tracking (entity count and change, entities ever seen, unique patterns, alive and died counts)</li>
        <li>Engagement counters (starred flag, share count, statistics-view count)</li>
        <li>Reproducibility fields (simulation version, engine commit, run hash)</li>
      </ul>
      <p class="mt-4">
        The export is generated on request directly from the live database, so it
        always reflects every run submitted up to that point. Responses carry a
        24-hour cache header, so a repeated download may be served from cache —
        add a cache-busting query string (or use a private window) if you need a
        guaranteed-fresh copy.
      </p>
    </div>
  `

  sections.appendChild(exportSection)
  root.appendChild(sections)

  const downloadButton =
    exportSection.querySelector<HTMLAnchorElement>('#research-download')
  if (!downloadButton) {
    throw new Error('[research] Failed to construct research panel elements')
  }

  return {
    root,
    elements: { sections, downloadButton },
  }
}
