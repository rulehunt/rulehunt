// src/components/mobile/buttons/statsButton.ts

import { trackStatsView } from '../../../api/stats-view'
import type { ICellularAutomata } from '../../../cellular-automata-interface'
import type { RuleData } from '../layout'
import { createRoundButton } from '../roundButton'

/**
 * Dependencies required by the stats button factory.
 * Uses dependency injection for module state access.
 */
export interface StatsButtonDeps {
  /** Callback to show the statistics modal/panel */
  onShowStats: () => void
  /** Optional callback to reset fade/transition state */
  onResetFade?: () => void
  /** Accessor to check if a transition is currently in progress */
  isTransitioning: () => boolean
  /** Optional accessor to get current CA/rule data for auto-save */
  getRunData?: () => {
    ca: ICellularAutomata
    rule: RuleData
    isStarred: boolean
  }
  /** Optional accessor to get the last saved run hash */
  getLastRunHash?: () => string | undefined
  /** Optional setter to update the last saved run hash */
  setLastRunHash?: (hash: string | undefined) => void
  /**
   * Optional callback to save run statistics and get the run hash.
   * Should be provided if auto-save functionality is desired.
   */
  saveRunStatistics?: (
    ca: ICellularAutomata,
    ruleName: string,
    ruleHex: string,
    isStarred: boolean,
  ) => Promise<string | undefined>
}

/**
 * Creates the statistics button with integrated auto-save functionality.
 * When clicked, shows statistics and automatically saves run data if not already saved.
 *
 * @param deps - Dependencies for button operation
 * @returns Button element and cleanup function
 */
export function createStatsButton(deps: StatsButtonDeps): {
  button: HTMLButtonElement
  cleanup: () => void
} {
  const {
    onShowStats,
    onResetFade,
    isTransitioning,
    getRunData,
    getLastRunHash,
    setLastRunHash,
    saveRunStatistics,
  } = deps

  const { button, cleanup } = createRoundButton(
    {
      icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
      title: 'View statistics',
      onClick: async () => {
        onShowStats()
        onResetFade?.()

        // Auto-save run statistics if not already saved
        let runHash = getLastRunHash?.()
        if (!runHash && getRunData && setLastRunHash && saveRunStatistics) {
          const { ca, rule, isStarred } = getRunData()
          runHash = await saveRunStatistics(ca, rule.name, rule.hex, isStarred)
          if (runHash) {
            setLastRunHash(runHash)
          }
        }

        // Track stats view event
        if (runHash) {
          trackStatsView(runHash)
        }
      },
      preventTransition: true,
    },
    isTransitioning,
  )

  return { button, cleanup }
}
