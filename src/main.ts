import {
  type CleanupFunction,
  setupDesktopLayout,
} from './components/desktop.ts'
import { setupMobileLayout } from './components/mobile.ts'

// --- Mobile Detection -------------------------------------------------------
function isMobile(): boolean {
  return window.innerWidth < 1024 // lg breakpoint
}

// --- Main ------------------------------------------------------------------
window.addEventListener('DOMContentLoaded', async () => {
  const appRoot = document.getElementById('app') as HTMLDivElement
  let currentLayout: 'mobile' | 'desktop' | null = null
  let currentCleanup: CleanupFunction | null = null

  async function updateLayout() {
    const shouldBeMobile = isMobile()
    const targetLayout = shouldBeMobile ? 'mobile' : 'desktop'

    if (currentLayout === targetLayout) return

    // Clean up current layout
    if (currentCleanup) {
      currentCleanup()
      currentCleanup = null
    }

    // Clear DOM
    appRoot.innerHTML = ''

    // Setup new layout
    if (shouldBeMobile) {
      currentCleanup = await setupMobileLayout(appRoot)
      currentLayout = 'mobile'
      console.log('Mobile layout initialized')
    } else {
      currentCleanup = await setupDesktopLayout(appRoot)
      currentLayout = 'desktop'
      console.log('Desktop layout initialized')
    }
  }

  // Initial layout
  await updateLayout()

  // Handle resize with debouncing
  let resizeTimeout: number
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout)
    resizeTimeout = window.setTimeout(updateLayout, 250)
  })
})
