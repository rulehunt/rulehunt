// src/components/mobile/ui/runHash.ts
import type { ICellularAutomata } from '../../../cellular-automata-interface'
import type { RuleData } from '../layout'

/** Snapshot of the currently displayed run, used when saving statistics. */
export interface RunData {
  ca: ICellularAutomata
  rule: RuleData
  isStarred: boolean
}

/** Persists a run and resolves to its hash, or undefined if the save failed. */
export type SaveRunStatisticsFn = (
  ca: ICellularAutomata,
  ruleName: string,
  ruleHex: string,
  isStarred?: boolean,
) => Promise<string | undefined>

/**
 * Returns the hash for the current run, saving it first if it has not been
 * saved yet.
 *
 * Buttons that report an interaction (share, stats view) need a run hash to
 * attach the event to. The run is saved lazily on the first such interaction,
 * so the first caller performs the save and stores the resulting hash for
 * subsequent callers.
 *
 * Every parameter is optional because the buttons are usable without
 * statistics wiring; if any of `getRunData`, `setLastRunHash` or
 * `saveRunStatistics` is missing, no save is attempted and whatever
 * `getLastRunHash` returned is passed through unchanged.
 *
 * @param getRunData - Returns the current run data (CA, rule, starred status)
 * @param getLastRunHash - Returns the hash already saved for this run, if any
 * @param setLastRunHash - Stores a newly saved hash for later callers
 * @param saveRunStatistics - Saves run statistics and resolves to the hash
 * @returns The existing or newly saved run hash, or undefined if unavailable
 */
export async function ensureRunHash(
  getRunData?: () => RunData,
  getLastRunHash?: () => string | undefined,
  setLastRunHash?: (hash: string | undefined) => void,
  saveRunStatistics?: SaveRunStatisticsFn,
): Promise<string | undefined> {
  const existingHash = getLastRunHash?.()
  if (existingHash) return existingHash

  if (!getRunData || !setLastRunHash || !saveRunStatistics) return undefined

  // First interaction with this rule - save it now
  const { ca, rule, isStarred } = getRunData()
  const runHash = await saveRunStatistics(ca, rule.name, rule.hex, isStarred)

  if (runHash) {
    setLastRunHash(runHash)
    console.log(`[tracking] Saved and stored hash for ${rule.name}: ${runHash}`)
  }

  return runHash
}
