// src/components/mobile/buttons/shareButton.ts

import type { ICellularAutomata } from '../../../cellular-automata-interface'
import { createRoundButton } from '../roundButton'
import { trackShare } from '../../../api/share'
import type { RuleData } from '../layout'

/**
 * Dependencies required by the share button factory.
 * Uses dependency injection for module state access.
 */
export interface ShareButtonDeps {
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
 * Creates the share button with clipboard copy and visual feedback.
 * Copies the current URL to clipboard and provides temporary visual confirmation.
 * Automatically saves run statistics before sharing if not already saved.
 *
 * @param deps - Dependencies for button operation
 * @returns Button element and cleanup function
 */
export function createShareButton(
  deps: ShareButtonDeps,
): {
  button: HTMLButtonElement
  cleanup: () => void
} {
  const {
    onResetFade,
    isTransitioning,
    getRunData,
    getLastRunHash,
    setLastRunHash,
    saveRunStatistics,
  } = deps

  const linkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`
  const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`

  const { button, cleanup } = createRoundButton(
    {
      icon: linkIcon,
      title: 'Copy shareable link',
      onClick: async () => {
        if (isTransitioning()) return
        onResetFade?.()

        const shareURL = window.location.href

        try {
          await navigator.clipboard.writeText(shareURL)

          // Auto-save run statistics if not already saved
          let runHash = getLastRunHash?.()
          if (!runHash && getRunData && setLastRunHash && saveRunStatistics) {
            const { ca, rule, isStarred } = getRunData()
            runHash = await saveRunStatistics(
              ca,
              rule.name,
              rule.hex,
              isStarred,
            )
            if (runHash) {
              setLastRunHash(runHash)
            }
          }

          // Track share event
          if (runHash) {
            trackShare(runHash)
          }

          // Visual feedback: swap to check icon briefly
          button.innerHTML = checkIcon
          setTimeout(() => {
            button.innerHTML = linkIcon
          }, 1500)
        } catch (err) {
          console.error('[share] Failed to copy link:', err)
        }
      },
    },
    isTransitioning,
  )

  return { button, cleanup }
}
