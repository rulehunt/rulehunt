// src/components/mobile/ui/favoritesModal.ts

import type { StarredPattern } from '../../../schema'
import type { CleanupFunction } from '../../../types'
import { fetchFavorites } from '../../../api/favorites'
import { getUserId } from '../../../identity'

export interface FavoritesModalElements {
  overlay: HTMLDivElement
  panel: HTMLDivElement
  closeButton: HTMLButtonElement
  content: HTMLDivElement
  grid: HTMLDivElement
}

export interface FavoritesModalConfig {
  onLoadFavorite: (favorite: StarredPattern) => void
}

export function createFavoritesModal(
  config: FavoritesModalConfig,
): {
  elements: FavoritesModalElements
  show: () => Promise<void>
  hide: () => void
} {
  const overlay = document.createElement('div')
  overlay.className =
    'absolute inset-0 z-[1100] bg-black/50 backdrop-blur-sm hidden items-center justify-center p-4 w-full h-full'
  overlay.style.display = 'none'

  const panel = document.createElement('div')
  panel.className =
    'bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-full max-h-[85%] flex flex-col overflow-hidden transform scale-95 transition-transform duration-300'

  const header = document.createElement('div')
  header.className =
    'flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between'
  header.innerHTML = `
    <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100">Your Favorites</h2>
    <button
      id="close-favorites"
      class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
      aria-label="Close"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
  `

  const content = document.createElement('div')
  content.className = 'flex-1 px-6 py-6 overflow-y-auto min-h-0'

  const grid = document.createElement('div')
  grid.className = 'grid grid-cols-2 gap-4'
  content.appendChild(grid)

  const closeButton = header.querySelector(
    '#close-favorites',
  ) as HTMLButtonElement

  panel.appendChild(header)
  panel.appendChild(content)
  overlay.appendChild(panel)
  document.body.appendChild(overlay)

  const elements: FavoritesModalElements = {
    overlay,
    panel,
    closeButton,
    content,
    grid,
  }

  const show = async () => {
    // Show loading state
    grid.innerHTML = `
      <div class="col-span-2 text-center py-8">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100"></div>
        <p class="mt-2 text-gray-600 dark:text-gray-400">Loading favorites...</p>
      </div>
    `

    overlay.style.display = 'flex'
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => {
      panel.classList.remove('scale-95')
      panel.classList.add('scale-100')
    })

    // Fetch favorites
    const userId = getUserId()
    const result = await fetchFavorites(userId, 50, 0)

    if (!result || result.favorites.length === 0) {
      // Empty state
      grid.innerHTML = `
        <div class="col-span-2 text-center py-12">
          <svg class="w-16 h-16 mx-auto text-gray-400 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
          <p class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No favorites yet!</p>
          <p class="text-sm text-gray-600 dark:text-gray-400">
            Star interesting patterns to save them here.
          </p>
        </div>
      `
      return
    }

    // Render favorite cards
    grid.innerHTML = ''
    for (const favorite of result.favorites) {
      const card = createFavoriteCard(favorite, config)
      grid.appendChild(card)
    }
  }

  const hide = () => {
    panel.classList.remove('scale-100')
    panel.classList.add('scale-95')
    setTimeout(() => {
      overlay.style.display = 'none'
      document.body.style.overflow = ''
    }, 300)
  }

  return { elements, show, hide }
}

function createFavoriteCard(
  favorite: StarredPattern,
  config: FavoritesModalConfig,
): HTMLElement {
  const card = document.createElement('div')
  card.className =
    'bg-gray-50 dark:bg-gray-700 rounded-lg p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors'

  // Placeholder preview (gradient)
  const preview = document.createElement('div')
  preview.className = 'w-full aspect-square rounded-md mb-3'
  preview.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'

  const name = document.createElement('div')
  name.className =
    'text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1 overflow-hidden text-ellipsis whitespace-nowrap'
  name.textContent = favorite.ruleset_name || 'Unnamed'
  name.title = favorite.ruleset_name || 'Unnamed'

  const hex = document.createElement('div')
  hex.className = 'text-xs text-gray-600 dark:text-gray-400 font-mono'
  hex.textContent = favorite.ruleset_hex.slice(0, 12) + '...'

  const seedInfo = document.createElement('div')
  seedInfo.className = 'text-xs text-gray-500 dark:text-gray-500 mt-2'
  seedInfo.textContent = `Seed: ${favorite.seed} (${favorite.seed_type})`

  card.appendChild(preview)
  card.appendChild(name)
  card.appendChild(hex)
  card.appendChild(seedInfo)

  card.addEventListener('click', () => {
    config.onLoadFavorite(favorite)
  })

  return card
}

export function setupFavoritesModal(
  elements: FavoritesModalElements,
  hideCallback: () => void,
): CleanupFunction {
  const { overlay, closeButton } = elements

  const closeHandler = () => {
    hideCallback()
  }

  const overlayClickHandler = (e: MouseEvent) => {
    if (e.target === overlay) {
      hideCallback()
    }
  }

  closeButton.addEventListener('click', closeHandler)
  overlay.addEventListener('click', overlayClickHandler)

  return () => {
    closeButton.removeEventListener('click', closeHandler)
    overlay.removeEventListener('click', overlayClickHandler)
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay)
    document.body.style.overflow = ''
  }
}
