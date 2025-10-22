// src/components/mobile/ui/shareButton.ts
import { trackShare } from '../../../api/share'
import type { ICellularAutomata } from '../../../cellular-automata-interface'
import type { RuleData } from '../layout'
import { createRoundButton } from '../roundButton'

/**
 * Creates the share button that copies a shareable link to the clipboard.
 *
 * @param onResetFade - Optional callback to reset button container fade timer
 * @param getRunData - Optional function to get current run data (CA, rule, starred status)
 * @param getLastRunHash - Optional function to get the last saved run hash
 * @param setLastRunHash - Optional function to set the last saved run hash
 * @param saveRunStatistics - Function to save run statistics and get hash
 * @param isTransitioningFn - Function that returns whether a transition is in progress
 * @returns Object with button element and cleanup function
 */
export function createShareButton(
  onResetFade?: () => void,
  getRunData?: () => {
    ca: ICellularAutomata
    rule: RuleData
    isStarred: boolean
  },
  getLastRunHash?: () => string | undefined,
  setLastRunHash?: (hash: string | undefined) => void,
  saveRunStatistics?: (
    ca: ICellularAutomata,
    ruleName: string,
    ruleHex: string,
    isStarred?: boolean,
  ) => Promise<string | undefined>,
  isTransitioningFn?: () => boolean,
): {
  button: HTMLButtonElement
  cleanup: () => void
} {
  const linkIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="currentColor" class="w-6 h-6">
      <path d="M13.544 10.456a4.368 4.368 0 0 0-6.176 0l-3.089 3.088a4.367 4.367 0 1 0 6.177 6.177L12 18.177a1 1 0 0 1 1.414 1.414l-1.544 1.544a6.368 6.368 0 0 1-9.005-9.005l3.089-3.088a6.367 6.367 0 0 1 9.005 0 1 1 0 1 1-1.415 1.414zm6.911-6.911a6.367 6.367 0 0 1 0 9.005l-3.089 3.088a6.367 6.367 0 0 1-9.005 0 1 1 0 1 1 1.415-1.414 4.368 4.368 0 0 0 6.176 0l3.089-3.088a4.367 4.367 0 1 0-6.177-6.177L12 6.503a1 1 0 0 1-1.414-1.414l1.544-1.544a6.367 6.367 0 0 1 9.005 0z"/>
    </svg>`

  const checkIcon = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
         fill="currentColor" class="w-6 h-6">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
    </svg>`

  const { button, cleanup } = createRoundButton(
    {
      icon: linkIcon,
      title: 'Copy shareable link',
      onClick: async () => {
        if (isTransitioningFn?.()) return

        onResetFade?.()

        // URL is kept in sync automatically by PR #35, just copy current URL
        const shareURL = window.location.href

        try {
          await navigator.clipboard.writeText(shareURL)
          console.log('[share] Copied link to clipboard:', shareURL)

          // Get or create run hash
          let runHash = getLastRunHash?.()

          if (!runHash && getRunData && setLastRunHash && saveRunStatistics) {
            // First share of this rule - save it now
            const { ca, rule, isStarred } = getRunData()
            runHash = await saveRunStatistics(
              ca,
              rule.name,
              rule.hex,
              isStarred,
            )

            if (runHash) {
              setLastRunHash(runHash)
              console.log(
                `[tracking] Saved and stored hash for ${rule.name}: ${runHash}`,
              )
            }
          }

          // Track the share
          if (runHash) {
            trackShare(runHash)
          }

          // Visual feedback - briefly change the button appearance
          button.innerHTML = checkIcon
          setTimeout(() => {
            button.innerHTML = linkIcon
          }, 1500)
        } catch (err) {
          console.error('[share] Failed to copy link:', err)
        }
      },
    },
    isTransitioningFn,
  )

  return { button, cleanup }
}
