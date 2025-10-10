// src/components/mobileHeader.ts

export interface MobileHeaderElements {
  titleElement: HTMLHeadingElement
  infoButton: HTMLButtonElement
  infoOverlay: HTMLDivElement
  closeButton: HTMLButtonElement
}

export type CleanupFunction = () => void

export function createMobileHeader(): {
  root: HTMLElement
  elements: MobileHeaderElements
} {
  const root = document.createElement('header')
  root.className =
    'fixed top-0 left-0 right-0 z-50 bg-white/70 dark:bg-gray-900/70 backdrop-blur-sm border-b border-gray-300/50 dark:border-gray-600/50 transition-opacity duration-500'
  root.style.opacity = '1'

  root.innerHTML = `
    <div class="px-6 py-3 flex items-center justify-between">
      <!-- Left: Logo/Title -->
      <h1 id="rulehunt-title" class="text-xl font-bold text-gray-900 dark:text-gray-100 transition-colors duration-500">
        RuleHunt
      </h1>

      <!-- Right: Info Button -->
      <button 
        id="info-button"
        class="p-2 rounded-full hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
        title="About RuleHunt"
        aria-label="Show information"
      >
        <svg class="w-6 h-6 text-gray-700 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" stroke-width="2"/>
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 16v-4m0-4h.01"/>
        </svg>
      </button>
    </div>
  `

  // Create info overlay (hidden by default)
  const infoOverlay = document.createElement('div')
  infoOverlay.id = 'info-overlay'
  infoOverlay.className =
    'fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm hidden items-center justify-center p-4'
  infoOverlay.style.display = 'none'

  infoOverlay.innerHTML = `
    <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
      <!-- Header -->
      <div class="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
        <h2 class="text-2xl font-bold text-gray-900 dark:text-gray-100">About RuleHunt</h2>
        <button 
          id="close-info"
          class="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          aria-label="Close"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="px-6 py-6 text-gray-700 dark:text-gray-300 space-y-4">
        <p class="text-lg font-semibold text-gray-900 dark:text-gray-100">
          A distributed exploration of the vast universe of cellular automata rules
        </p>
        
        <p>
          RuleHunt is a web-based platform for discovering interesting patterns in the combinatorial 
          space of 2D cellular automata. We're building a TikTok-style interface where visitors can 
          contribute their device's computing power to explore and catalog fascinating emergent 
          behaviors.
        </p>

        <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">🎯 The Vision</h3>
          <p>
            Conway's Game of Life is just <em>one</em> rule out of 2<sup>512</sup> possible 3x3 
            cellular automata rules. What other fascinating patterns are hiding in this 
            incomprehensibly large space?
          </p>
        </div>

        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">📊 The Search Space</h3>
          <p>
            In a 2D cellular automaton with binary states, each cell's next state is determined by 
            its 3x3 neighborhood. With 9 cells that can each be alive or dead, there are 
            <strong>2<sup>9</sup> = 512 possible neighborhoods</strong>.
          </p>
          <p class="mt-2">
            A "rule" maps each of these 512 neighborhoods to an output state, giving us 
            <strong>2<sup>512</sup> ≈ 1.34 x 10<sup>154</sup> possible rules</strong> — more than 
            atoms in the observable universe!
          </p>
        </div>

        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">🔄 C4 Symmetry</h3>
          <p>
            By requiring rules to respect rotational symmetry (treating rotated patterns the same), 
            we reduce the space to <strong>2<sup>140</sup> ≈ 1.39 x 10<sup>42</sup> symmetric rules</strong>. 
            Still astronomical, but more tractable!
          </p>
        </div>

        <div class="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">📱 How to Use</h3>
          <p class="mb-2">
            <strong>Swipe up</strong> to explore a new random cellular automata rule. 
            Each swipe generates a unique simulation with different behavior patterns.
          </p>
          <p>
            <strong>Tap the + / - buttons</strong> in the lower-left corner to zoom in and out.
          </p>
        </div>

        <div>
          <h3 class="font-semibold text-gray-900 dark:text-gray-100 mb-2">🎉 Origin Story</h3>
          <p>
            Created for the <strong>ALife 2025 Hackathon</strong> (October 7-9, 2025) at the 
            Artificial Life conference in Kyoto, Japan. Theme: "Exploration of emergence in 
            complex systems."
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div class="sticky bottom-0 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        <a
          href="https://github.com/rulehunt/rulehunt"
          target="_blank"
          rel="noopener noreferrer"
          class="flex items-center justify-center gap-2 w-full px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path fill-rule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clip-rule="evenodd" />
          </svg>
          <span>View on GitHub</span>
        </a>
      </div>
    </div>
  `

  document.body.appendChild(infoOverlay)

  const elements: MobileHeaderElements = {
    titleElement: root.querySelector('#rulehunt-title') as HTMLHeadingElement,
    infoButton: root.querySelector('#info-button') as HTMLButtonElement,
    infoOverlay: infoOverlay,
    closeButton: infoOverlay.querySelector('#close-info') as HTMLButtonElement,
  }

  return { root, elements }
}

export function setupMobileHeader(
  elements: MobileHeaderElements,
  headerRoot: HTMLElement,
): { cleanup: CleanupFunction; resetFade: () => void } {
  const { infoButton, infoOverlay, closeButton } = elements

  let fadeTimer: number | null = null
  const resetFade = () => {
    if (fadeTimer) clearTimeout(fadeTimer)
    headerRoot.style.opacity = '1'
    fadeTimer = window.setTimeout(() => {
      headerRoot.style.opacity = '0.3'
    }, 3000)
  }

  const showOverlay = () => {
    infoOverlay.style.display = 'flex'
    // Prevent body scrolling when overlay is open
    document.body.style.overflow = 'hidden'
  }

  const hideOverlay = () => {
    infoOverlay.style.display = 'none'
    // Restore body scrolling
    document.body.style.overflow = ''
  }

  // Show overlay when info button is clicked
  const infoHandler = () => {
    showOverlay()
    resetFade()
  }

  // Hide overlay when close button is clicked
  const closeHandler = () => {
    hideOverlay()
  }

  // Hide overlay when clicking outside the content box
  const overlayClickHandler = (e: MouseEvent) => {
    if (e.target === infoOverlay) {
      hideOverlay()
    }
  }

  // Add event listeners
  infoButton.addEventListener('click', infoHandler)
  closeButton.addEventListener('click', closeHandler)
  infoOverlay.addEventListener('click', overlayClickHandler)

  // Start the initial fade timer
  resetFade()

  // Return cleanup function and resetFade function
  return {
    cleanup: () => {
      if (fadeTimer) clearTimeout(fadeTimer)
      infoButton.removeEventListener('click', infoHandler)
      closeButton.removeEventListener('click', closeHandler)
      infoOverlay.removeEventListener('click', overlayClickHandler)

      // Clean up overlay from DOM
      if (infoOverlay.parentNode) {
        infoOverlay.parentNode.removeChild(infoOverlay)
      }

      // Restore body scroll in case it was locked
      document.body.style.overflow = ''
    },
    resetFade,
  }
}
