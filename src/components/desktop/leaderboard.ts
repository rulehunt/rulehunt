import { fetchLeaderboard } from '../../api/leaderboard'

export interface LeaderboardElements {
  tableBody: HTMLTableSectionElement
  refreshButton: HTMLButtonElement
  sortSelect: HTMLSelectElement
}

type SortMode = 'recent' | 'longest' | 'interesting'

export function createLeaderboardPanel(): {
  root: HTMLDivElement
  elements: LeaderboardElements
} {
  const root = document.createElement('div')
  root.className =
    'w-full border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800 p-4 mt-4'

  // --- Construct HTML skeleton ---
  root.innerHTML = `
    <div class="flex justify-between items-center mb-3">
      <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">🏆 Leaderboard</h3>

      <div class="flex items-center space-x-2">
        <select
          id="sort-mode"
          class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-400"
          title="Sort leaderboard"
        >
          <option value="longest" selected>⏱️ Longest Watched</option>
          <option value="recent">🕒 Most Recent</option>
          <option value="interesting">💡 Most Interesting</option>
        </select>

        <button
          id="refresh-leaderboard"
          class="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          title="Refresh leaderboard"
        >
          Refresh
        </button>
      </div>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full text-sm text-left border-t border-gray-200 dark:border-gray-700">
        <thead class="text-xs uppercase text-gray-500 dark:text-gray-400">
          <tr>
            <th class="px-2 py-1">#</th>
            <th class="px-2 py-1">Timestamp</th>
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

  const selectEl = root.querySelector('#sort-mode')
  if (!(selectEl instanceof HTMLSelectElement)) {
    throw new Error('Missing #sort-mode <select> element')
  }

  const elements: LeaderboardElements = {
    tableBody: root.querySelector(
      '#leaderboard-body',
    ) as HTMLTableSectionElement,
    refreshButton: root.querySelector(
      '#refresh-leaderboard',
    ) as HTMLButtonElement,
    sortSelect: selectEl,
  }

  let currentSort: SortMode = 'longest'

  // --- Helper to load leaderboard data ---
  async function loadLeaderboard() {
    try {
      const results = await fetchLeaderboard(10, currentSort)

      elements.tableBody.innerHTML = ''

      if (results.length === 0) {
        elements.tableBody.innerHTML = `
          <tr><td colspan="6" class="text-center py-3 text-gray-500 dark:text-gray-400">
            No results yet for this mode.
          </td></tr>
        `
        return
      }

      for (const [idx, row] of results.entries()) {
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

        const submitted = new Date(row.submitted_at).toLocaleString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        tr.innerHTML = `        
          <td class="px-2 py-1">${idx + 1}</td>
          <td class="px-2 py-1 text-right text-gray-500 dark:text-gray-400">${submitted}</td>
          <td class="px-2 py-1 font-mono truncate" title="${row.ruleset_hex ?? ''}">${row.ruleset_name ?? '—'}</td>
          <td class="px-2 py-1 text-xs">${row.user_label ?? row.user_id ?? 'anon'}</td>
          <td class="px-2 py-1 text-right">${seconds}s</td>
          <td class="px-2 py-1 text-right">${interest}</td>
          <td class="px-2 py-1 text-right">${entropy}</td>
        `
        elements.tableBody.appendChild(tr)
      }
    } catch (err) {
      console.error('Leaderboard load failed:', err)
      elements.tableBody.innerHTML = `
        <tr><td colspan="6" class="text-center py-3 text-red-500">
          Error loading leaderboard
        </td></tr>
      `
    }
  }

  // --- Event listeners ---
  elements.refreshButton.addEventListener('click', () => loadLeaderboard())
  elements.sortSelect.addEventListener('change', (e) => {
    currentSort = (e.target as HTMLSelectElement).value as SortMode
    loadLeaderboard()
  })

  // --- Initial load ---
  loadLeaderboard()

  return { root, elements }
}
