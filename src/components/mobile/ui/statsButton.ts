// src/components/mobile/ui/statsButton.ts
import { trackStatsView } from '../../../api/stats-view'
import { createRoundButton } from '../roundButton'
import {
  ensureRunHash,
  type RunData,
  type SaveRunStatisticsFn,
} from './runHash'

/**
 * Creates the stats button that displays simulation statistics.
 *
 * @param onShowStats - Callback to show the stats overlay
 * @param onResetFade - Optional callback to reset button container fade timer
 * @param getRunData - Optional function to get current run data (CA, rule, starred status)
 * @param getLastRunHash - Optional function to get the last saved run hash
 * @param setLastRunHash - Optional function to set the last saved run hash
 * @param saveRunStatistics - Function to save run statistics and get hash
 * @param isTransitioningFn - Function that returns whether a transition is in progress
 * @returns Object with button element and cleanup function
 */
export function createStatsButton(
  onShowStats: () => void,
  onResetFade?: () => void,
  getRunData?: () => RunData,
  getLastRunHash?: () => string | undefined,
  setLastRunHash?: (hash: string | undefined) => void,
  saveRunStatistics?: SaveRunStatisticsFn,
  isTransitioningFn?: () => boolean,
): { button: HTMLButtonElement; cleanup: () => void } {
  const { button, cleanup } = createRoundButton(
    {
      icon: `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             fill="currentColor" class="w-6 h-6">
          <path d="M3 13h2v8H3v-8zm4-4h2v12H7V9zm4-4h2v16h-2V5zm4 2h2v14h-2V7z"/>
        </svg>`,
      title: 'View statistics',
      onClick: async () => {
        onShowStats()
        onResetFade?.()

        // Get or create run hash
        const runHash = await ensureRunHash(
          getRunData,
          getLastRunHash,
          setLastRunHash,
          saveRunStatistics,
        )

        // Track the stats view
        if (runHash) {
          trackStatsView(runHash)
        }
      },
      preventTransition: true,
    },
    isTransitioningFn,
  )

  return { button, cleanup }
}
