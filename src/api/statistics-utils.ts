import type { ICellularAutomata } from '../cellular-automata-interface'
import type { GridStatistics, SimulationMetadata } from '../statistics'

/** Default stats when no data available */
export const DEFAULT_RECENT_STATS: GridStatistics = {
  population: 0,
  activity: 0,
  populationChange: 0,
  entropy2x2: 0,
  entropy4x4: 0,
  entropy8x8: 0,
  entityCount: 0,
  entityChange: 0,
  totalEntitiesEverSeen: 0,
  uniquePatterns: 0,
  entitiesAlive: 0,
  entitiesDied: 0,
}

export interface RunStatsSnapshot {
  metadata: SimulationMetadata | null
  recent: GridStatistics
}

/**
 * Safely extract statistics snapshot from CA instance
 * @param ca Cellular automata instance
 * @returns Statistics metadata and most recent stats
 */
export function getRunStatsSnapshot(ca: ICellularAutomata): RunStatsSnapshot {
  const stats = ca.getStatistics()
  const metadata = stats.getMetadata()
  const recent = stats.getRecentStats(1)[0] ?? DEFAULT_RECENT_STATS

  return { metadata, recent }
}
