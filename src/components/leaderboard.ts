// src/components/leaderboard.ts
import type { LeaderboardResponse } from '../schema'

export interface LeaderboardElements {
  tableBody: HTMLTableSectionElement
  refreshButton: HTMLButtonElement
}

export function createLeaderboardPanel(): {
  root: HTMLDivElement
  elements: LeaderboardElements
} {
  const root = document.createElement('div')
  root.className =
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 mt-4'

  root.innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">🏆 Leaderboard</h3>
      <button
        id="refresh-leaderboard"
        class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      >
        Refresh
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm text-left border-t border-gray-200 dark:border-gray-700">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400">
          <tr>
            <th class="px-2 py-1">#</th>
            <th class="px-2 py-1">Ruleset</th>
            <th class="px-2 py-1">User</th>
            <th class="px-2 py-1 text-right">Watch Time</th>
            <th class="px-2 py-1 text-right">Interest</th>
            <th class="px-2 py-1 text-right">Entropy</th>
          </tr>
        </thead>
        <tbody id="leaderboard-body" class="divide-y divide-gray-100 dark:divide-gray-700"></tbody>
      </table>
    </div>
  `

  const elements: LeaderboardElements = {
    tableBody: root.querySelector(
      '#leaderboard-body',
    ) as HTMLTableSectionElement,
    refreshButton: root.querySelector(
      '#refresh-leaderboard',
    ) as HTMLButtonElement,
  }

  // --- Helper to load leaderboard data ---
  async function loadLeaderboard() {
    try {
      const res = await fetch('/api/leaderboard')
      const data: LeaderboardResponse = await res.json()

      // Fixed: Use for...of instead of forEach
      for (const row of data.results) {
        console.log(row.ruleset_name, row.watched_wall_ms)
      }

      elements.tableBody.innerHTML = ''

      if (
        !data.ok ||
        !Array.isArray(data.results) ||
        data.results.length === 0
      ) {
        elements.tableBody.innerHTML = `
          <tr><td colspan="6" class="text-center py-3 text-gray-500 dark:text-gray-400">No results yet.</td></tr>
        `
        return
      }

      // Fixed: Use for...of with entries() instead of forEach with any
      for (const [idx, row] of data.results.entries()) {
        const tr = document.createElement('tr')
        tr.className =
          idx < 3
            ? 'bg-yellow-100 dark:bg-yellow-900/20 font-semibold'
            : idx % 2 === 0
              ? 'bg-gray-50 dark:bg-gray-900/30'
              : ''

        const seconds = Math.round((row.watched_wall_ms ?? 0) / 1000)
        const interest = (row.interest_score ?? 0).toFixed(2)
        const entropy = (row.entropy4x4 ?? 0).toFixed(1)

        tr.innerHTML = `
          <td class="px-2 py-1">${idx + 1}</td>
          <td class="px-2 py-1 font-mono truncate" title="${row.ruleset_hex ?? ''}">
            ${row.ruleset_name ?? '—'}
          </td>
          <td class="px-2 py-1 text-xs">${row.user_label ?? row.user_id ?? 'anon'}</td>
          <td class="px-2 py-1 text-right">${seconds}s</td>
          <td class="px-2 py-1 text-right">${interest}</td>
          <td class="px-2 py-1 text-right">${entropy}</td>
        `
        elements.tableBody.appendChild(tr)
      }
    } catch (err) {
      console.error('Leaderboard fetch failed:', err)
      elements.tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-3 text-red-500">Error loading leaderboard</td></tr>
      `
    }
  }

  // --- Hook up the refresh button ---
  elements.refreshButton.addEventListener('click', () => loadLeaderboard())

  // --- Initial load ---
  loadLeaderboard()

  return { root, elements }
}
