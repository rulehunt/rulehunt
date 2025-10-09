import type { Coordinate, Grid } from './schema'

export interface Entity {
  cells: Coordinate[]
  id?: string
  canonicalPattern?: string
}

export function normalizePattern(cells: Coordinate[]): string {
  if (cells.length === 0) return ''

  // Find bounding box
  const minX = Math.min(...cells.map(c => c.x))
  const minY = Math.min(...cells.map(c => c.y))
  const maxX = Math.max(...cells.map(c => c.x))
  const maxY = Math.max(...cells.map(c => c.y))

  // Translate to origin
  const translated = cells.map(c => ({ x: c.x - minX, y: c.y - minY }))
  const width = maxX - minX + 1
  const height = maxY - minY + 1

  // Generate all 8 transformations (4 rotations × 2 reflections)
  const transformations: string[] = []

  // Helper to convert cells to string representation
  const cellsToString = (cells: Coordinate[]): string => {
    const sorted = cells.sort((a, b) => a.y === b.y ? a.x - b.x : a.y - b.y)
    return sorted.map(c => `${c.x},${c.y}`).join(';')
  }

  // Original
  transformations.push(cellsToString(translated))

  // 90° rotation
  const rot90 = translated.map(c => ({ x: height - 1 - c.y, y: c.x }))
  transformations.push(cellsToString(rot90))

  // 180° rotation
  const rot180 = translated.map(c => ({ x: width - 1 - c.x, y: height - 1 - c.y }))
  transformations.push(cellsToString(rot180))

  // 270° rotation
  const rot270 = translated.map(c => ({ x: c.y, y: width - 1 - c.x }))
  transformations.push(cellsToString(rot270))

  // Horizontal reflection
  const reflectH = translated.map(c => ({ x: width - 1 - c.x, y: c.y }))
  transformations.push(cellsToString(reflectH))

  // Vertical reflection
  const reflectV = translated.map(c => ({ x: c.x, y: height - 1 - c.y }))
  transformations.push(cellsToString(reflectV))

  // Diagonal reflections
  const reflectD1 = translated.map(c => ({ x: c.y, y: c.x }))
  transformations.push(cellsToString(reflectD1))

  const reflectD2 = translated.map(c => ({ x: height - 1 - c.y, y: width - 1 - c.x }))
  transformations.push(cellsToString(reflectD2))

  // Return lexicographically smallest transformation
  return transformations.sort()[0]
}

export interface EntityStats {
  totalEntities: number          // Total number of unique entity IDs that have appeared
  uniquePatterns: number         // Number of distinct pattern types
  entitiesAlive: number          // Number of entities currently alive
  entitiesDied: number           // Number of unique entities that have died
}

export class EntityTracker {
  private knownPatterns: Map<string, string> = new Map() // canonicalPattern -> id
  private entityPhases: Map<string, Set<string>> = new Map() // id -> Set of canonical patterns
  private nextId: number = 1
  private entitiesSeenLastStep: Set<string> = new Set() // IDs seen in the last step
  private allEntitiesEverSeen: Set<string> = new Set()  // All unique entity IDs ever seen
  private deadEntities: Set<string> = new Set()          // Entity IDs that have died
  private uniquePatternTypes: Set<string> = new Set()    // Unique canonical patterns seen

  trackEntities(entities: Entity[]): Entity[] {
    // Track which entities are seen in this step
    const currentStepEntityIds = new Set<string>()
    
    const trackedEntities = entities.map(entity => {
      const canonical = normalizePattern(entity.cells)
      
      // Check if this pattern belongs to any known entity
      let entityId = this.knownPatterns.get(canonical)
      
      if (!entityId) {
        // Check if this is a new phase of an existing entity
        for (const [id, phases] of this.entityPhases) {
          if (phases.has(canonical)) {
            entityId = id
            break
          }
        }
        
        // If still no match, create new entity
        if (!entityId) {
          entityId = `E${this.nextId++}`
          this.entityPhases.set(entityId, new Set())
        }
      }

      // Record this pattern
      this.knownPatterns.set(canonical, entityId)
      this.entityPhases.get(entityId)!.add(canonical)
      
      // Track this entity as seen in current step
      currentStepEntityIds.add(entityId)
      this.allEntitiesEverSeen.add(entityId)
      
      // Track unique pattern types
      this.uniquePatternTypes.add(canonical)

      return {
        ...entity,
        id: entityId,
        canonicalPattern: canonical
      }
    })
    
    // Check for entities that died (were alive last step but not this step)
    for (const id of this.entitiesSeenLastStep) {
      if (!currentStepEntityIds.has(id)) {
        this.deadEntities.add(id)
      }
    }
    
    // Update entities seen last step
    this.entitiesSeenLastStep = currentStepEntityIds
    
    return trackedEntities
  }

  // Method to manually associate patterns as belonging to the same entity
  associatePatterns(pattern1: string, pattern2: string) {
    let id1 = this.knownPatterns.get(pattern1)
    let id2 = this.knownPatterns.get(pattern2)

    // If neither pattern has an ID, create a new entity
    if (!id1 && !id2) {
      const entityId = `E${this.nextId++}`
      this.knownPatterns.set(pattern1, entityId)
      this.knownPatterns.set(pattern2, entityId)
      this.entityPhases.set(entityId, new Set([pattern1, pattern2]))
      return
    }

    // If only one has an ID, assign the other to the same entity
    if (id1 && !id2) {
      this.knownPatterns.set(pattern2, id1)
      this.entityPhases.get(id1)!.add(pattern2)
      return
    }

    if (!id1 && id2) {
      this.knownPatterns.set(pattern1, id2)
      this.entityPhases.get(id2)!.add(pattern1)
      return
    }

    // Both have IDs
    if (id1 && id2 && id1 !== id2) {
      // Merge entity 2 into entity 1
      const phases2 = this.entityPhases.get(id2) || new Set()
      const phases1 = this.entityPhases.get(id1) || new Set()
      
      // Add all phases from entity 2 to entity 1
      for (const phase of phases2) {
        phases1.add(phase)
        this.knownPatterns.set(phase, id1)
      }
      
      this.entityPhases.set(id1, phases1)
      this.entityPhases.delete(id2)
    }
  }

  getStats(): EntityStats {
    return {
      totalEntities: this.allEntitiesEverSeen.size,
      uniquePatterns: this.uniquePatternTypes.size,
      entitiesAlive: this.entitiesSeenLastStep.size,
      entitiesDied: this.deadEntities.size
    }
  }

  reset() {
    this.knownPatterns.clear()
    this.entityPhases.clear()
    this.nextId = 1
    this.entitiesSeenLastStep.clear()
    this.allEntitiesEverSeen.clear()
    this.deadEntities.clear()
    this.uniquePatternTypes.clear()
  }
}

export function detectEntities(grid: Grid, tracker?: EntityTracker): Entity[] {
  const height = grid.length
  const width = grid[0]?.length ?? 0

  if (height !== 10 || width !== 10) {
    throw new Error('Grid must be 10x10')
  }

  const visited = Array(height)
    .fill(null)
    .map(() => Array(width).fill(false))
  const entities: Entity[] = []

  const getCell = (y: number, x: number): 0 | 1 => {
    const wrappedY = ((y % height) + height) % height
    const wrappedX = ((x % width) + width) % width
    return grid[wrappedY][wrappedX]
  }

  const hasEmptyBorder = (cells: Coordinate[]): boolean => {
    const borderCells = new Set<string>()

    for (const { x, y } of cells) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (Math.abs(dy) === 2 || Math.abs(dx) === 2) {
            borderCells.add(`${y + dy},${x + dx}`)
          }
        }
      }
    }

    const entityCells = new Set(cells.map(({ x, y }) => `${y},${x}`))

    for (const cellStr of borderCells) {
      if (!entityCells.has(cellStr)) {
        const [y, x] = cellStr.split(',').map(Number)
        if (getCell(y, x) === 1) {
          return false
        }
      }
    }

    return true
  }

  const bfs = (startY: number, startX: number): Coordinate[] => {
    const queue: Coordinate[] = [{ x: startX, y: startY }]
    const component: Coordinate[] = []
    visited[startY][startX] = true

    while (queue.length > 0) {
      const coord = queue.shift()
      if (!coord) continue
      component.push(coord)

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue

          const newY = (((coord.y + dy) % height) + height) % height
          const newX = (((coord.x + dx) % width) + width) % width

          if (!visited[newY][newX] && grid[newY][newX] === 1) {
            visited[newY][newX] = true
            queue.push({ x: newX, y: newY })
          }
        }
      }
    }

    return component
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (grid[y][x] === 1 && !visited[y][x]) {
        const component = bfs(y, x)
        if (hasEmptyBorder(component)) {
          entities.push({ cells: component })
        }
      }
    }
  }

  // If tracker is provided, track the entities
  if (tracker) {
    return tracker.trackEntities(entities)
  }

  return entities
}
