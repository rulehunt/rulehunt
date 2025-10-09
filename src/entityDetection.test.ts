import { describe, expect, it } from 'vitest'
import testData from '../resources/conway-test-sequences-detailed.json'
import {
  type EntityStats,
  EntityTracker,
  detectEntities,
  normalizePattern,
} from './entityDetection'
import type { Grid } from './schema'

describe('Entity Detection', () => {
  it('should detect a single cell entity with 2-cell border', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(1)
    expect(entities[0].cells).toHaveLength(1)
    expect(entities[0].cells[0]).toEqual({ x: 3, y: 3 })
  })

  it('should detect a 2x2 square entity', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(1)
    const sortedCells = entities[0].cells.sort((a, b) => a.y - b.y || a.x - b.x)
    expect(sortedCells).toEqual([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ])
  })

  it('should not detect entity without proper 2-cell border', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(0)
  })

  it('should detect entity wrapping around torus edges', () => {
    const grid: Grid = [
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(1)
    const sortedCells = entities[0].cells.sort((a, b) => a.y - b.y || a.x - b.x)
    expect(sortedCells).toEqual([
      { x: 0, y: 0 },
      { x: 9, y: 0 },
      { x: 0, y: 9 },
      { x: 9, y: 9 },
    ])
  })

  it('should detect multiple separate entities', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(2)
    expect(entities[0].cells).toEqual([{ x: 2, y: 2 }])
    expect(entities[1].cells).toEqual([{ x: 6, y: 6 }])
  })

  it('should detect diagonal line as single entity', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(1)
    const sortedCells = entities[0].cells.sort((a, b) => a.y - b.y || a.x - b.x)
    expect(sortedCells).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 3 },
      { x: 4, y: 4 },
    ])
  })

  it('should not detect entities too close to each other', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(0)
  })

  it('should handle glider pattern', () => {
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid)
    expect(entities).toHaveLength(1)
    const sortedCells = entities[0].cells.sort((a, b) => a.y - b.y || a.x - b.x)
    expect(sortedCells).toEqual([
      { x: 3, y: 2 },
      { x: 4, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ])
  })
})

describe('Entity Identity Tracking', () => {
  it('should normalize patterns correctly', () => {
    // Test simple square in different positions
    const square1 = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ]

    const square2 = [
      { x: 5, y: 5 },
      { x: 6, y: 5 },
      { x: 5, y: 6 },
      { x: 6, y: 6 },
    ]

    expect(normalizePattern(square1)).toBe(normalizePattern(square2))
  })

  it('should recognize rotated patterns as identical', () => {
    // L-shape
    const lShape1 = [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ]

    // 90° rotated L-shape
    const lShape2 = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ]

    expect(normalizePattern(lShape1)).toBe(normalizePattern(lShape2))
  })

  it('should track entity identity across steps', () => {
    const tracker = new EntityTracker()

    // Step 1: Initial entity
    const grid1: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities1 = detectEntities(grid1, tracker)
    expect(entities1).toHaveLength(1)
    expect(entities1[0].id).toBe('E1')

    // Step 2: Same entity moved
    const grid2: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities2 = detectEntities(grid2, tracker)
    expect(entities2).toHaveLength(1)
    expect(entities2[0].id).toBe('E1') // Same ID as before
  })

  it('should assign same ID to entities with same pattern', () => {
    const tracker = new EntityTracker()

    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid, tracker)
    expect(entities).toHaveLength(2)
    expect(entities[0].id).toBe('E1')
    expect(entities[1].id).toBe('E1') // Both single cells have same pattern, so same ID
  })

  it('should assign different IDs to different patterns', () => {
    const tracker = new EntityTracker()

    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 1, 1, 0, 0], // Single cell and a 2-cell horizontal bar
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities = detectEntities(grid, tracker)
    expect(entities).toHaveLength(2)
    expect(entities[0].id).toBe('E1')
    expect(entities[1].id).toBe('E2') // Different pattern, different ID
  })

  it('should handle entity phase changes', () => {
    const tracker = new EntityTracker()

    // Simulate blinker oscillator phase 1 (horizontal)
    const phase1 = [
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
    ]

    // Phase 2 (vertical) - these are the same when normalized due to rotation
    const phase2 = [
      { x: 4, y: 2 },
      { x: 4, y: 3 },
      { x: 4, y: 4 },
    ]

    // Get canonical patterns
    const pattern1 = normalizePattern(phase1)
    const pattern2 = normalizePattern(phase2)

    // They should be the same pattern due to rotation normalization
    expect(pattern1).toBe(pattern2)

    // Let's test with actually different patterns
    const differentPattern = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ] // A 2x2 square

    const pattern3 = normalizePattern(differentPattern)
    expect(pattern1).not.toBe(pattern3)

    // Associate different patterns as the same entity
    tracker.associatePatterns(pattern1, pattern3)

    // Now when we detect either pattern, they should have the same ID
    const grid1: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities1 = detectEntities(grid1, tracker)
    const id1 = entities1[0].id

    // Test with the 2x2 square pattern
    const grid2: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    const entities2 = detectEntities(grid2, tracker)
    expect(entities2[0].id).toBe(id1) // Same entity ID due to association
  })

  it('should reset tracker state', () => {
    const tracker = new EntityTracker()

    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    detectEntities(grid, tracker)
    tracker.reset()

    const entities = detectEntities(grid, tracker)
    expect(entities[0].id).toBe('E1') // Should start from E1 again
  })
})

describe('Entity Tracking with Conway Sequences', () => {
  it('should track blinker oscillator through its phases', () => {
    const tracker = new EntityTracker()
    const blinkerData = testData.sequences.find((s) => s.name === 'blinker')!
    const blinkerSeq = blinkerData.grids as Grid[]

    // Detect entities across all steps
    const entitiesByStep = blinkerSeq.map((grid) =>
      detectEntities(grid, tracker),
    )

    // All steps should have exactly one entity
    entitiesByStep.forEach((entities) => {
      expect(entities).toHaveLength(1)
    })

    // All entities should have the same ID (it's the same oscillator)
    const firstId = entitiesByStep[0][0].id
    entitiesByStep.forEach((entities) => {
      expect(entities[0].id).toBe(firstId)
    })
  })

  it('should keep block still life with same ID', () => {
    const tracker = new EntityTracker()
    const blockData = testData.sequences.find((s) => s.name === 'block')!
    const blockSeq = blockData.grids as Grid[]

    const entitiesByStep = blockSeq.map((grid) => detectEntities(grid, tracker))

    // All steps should have exactly one entity
    entitiesByStep.forEach((entities) => {
      expect(entities).toHaveLength(1)
    })

    // Block should maintain same ID (it's a still life)
    const firstId = entitiesByStep[0][0].id
    entitiesByStep.forEach((entities) => {
      expect(entities[0].id).toBe(firstId)
    })
  })

  // TODO: Add glider test once glider sequence is added to test data
  // it('should track glider spaceship movement', () => { ... })

  it('should track multiple entities independently', () => {
    const tracker = new EntityTracker()
    const twoEntData = testData.sequences.find((s) => s.name === 'twoEntities')!
    const twoEntSeq = twoEntData.grids as Grid[]

    const entitiesByStep = twoEntSeq.map((grid) =>
      detectEntities(grid, tracker),
    )

    // All steps should have exactly two entities
    entitiesByStep.forEach((entities) => {
      expect(entities).toHaveLength(2)
    })

    // Collect all unique IDs seen
    const uniqueIds = new Set<string>()
    entitiesByStep.forEach((entities) => {
      entities.forEach((entity) => {
        if (entity.id) uniqueIds.add(entity.id)
      })
    })

    // Should have exactly 2 unique entity IDs
    expect(uniqueIds.size).toBe(2)
  })

  it('should track toad oscillator with shape changes', () => {
    const tracker = new EntityTracker()
    const toadData = testData.sequences.find((s) => s.name === 'toad')!
    const toadSeq = toadData.grids as Grid[]

    // Pre-associate toad patterns since phase 2 has disconnected cells
    // Phase 1 pattern (connected)
    // const phase1Pattern = '0,0;1,0;2,0;0,1;1,1;2,1'
    // Phase 2 would have disconnected cells, so we track the phase 1 entity only

    const entitiesByStep = toadSeq.map((grid) => detectEntities(grid, tracker))

    // Phase 1 (steps 0 and 2) should have one entity
    expect(entitiesByStep[0]).toHaveLength(1)
    expect(entitiesByStep[2]).toHaveLength(1)

    // Phase 2 (steps 1 and 3) won't be detected as single entity due to disconnected cells
    expect(entitiesByStep[1]).toHaveLength(0)
    expect(entitiesByStep[3]).toHaveLength(0)

    // Phase 1 entities should have the same ID
    expect(entitiesByStep[0][0].id).toBe(entitiesByStep[2][0].id)
  })

  it('should handle entity death without reusing IDs', () => {
    const tracker = new EntityTracker()
    const deathData = testData.sequences.find((s) => s.name === 'entityDeath')!
    const deathSeq = deathData.grids as Grid[]

    const entitiesByStep = deathSeq.map((grid) => detectEntities(grid, tracker))

    // First step should have 3 entities
    expect(entitiesByStep[0]).toHaveLength(3)

    // Remaining steps should have 2 entities (one died)
    for (let i = 1; i < entitiesByStep.length; i++) {
      expect(entitiesByStep[i]).toHaveLength(2)
    }

    // Collect all unique IDs
    const allIds = new Set<string>()
    entitiesByStep.forEach((entities) => {
      entities.forEach((entity) => {
        if (entity.id) allIds.add(entity.id)
      })
    })

    // Should have exactly 3 unique IDs (E1, E2, E3)
    expect(allIds.size).toBe(3)

    // E1 should only appear in the first step
    const e1Steps = entitiesByStep.map((entities, step) => ({
      step,
      hasE1: entities.some((e) => e.id === 'E1'),
    }))
    expect(e1Steps[0].hasE1).toBe(true)
    for (let i = 1; i < e1Steps.length; i++) {
      expect(e1Steps[i].hasE1).toBe(false)
    }

    // E2 and E3 should appear in all steps
    entitiesByStep.forEach((entities) => {
      const ids = entities.map((e) => e.id).sort()
      if (entities.length === 3) {
        expect(ids).toEqual(['E1', 'E2', 'E3'])
      } else {
        expect(ids).toEqual(['E2', 'E3'])
      }
    })
  })
})

describe('Entity Statistics Tracking', () => {
  it('should track basic entity statistics', () => {
    const tracker = new EntityTracker()

    // Step 1: One entity
    const grid1: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    detectEntities(grid1, tracker)
    let stats = tracker.getStats()
    expect(stats.totalEntities).toBe(1)
    expect(stats.uniquePatterns).toBe(1)
    expect(stats.entitiesAlive).toBe(1)
    expect(stats.entitiesDied).toBe(0)

    // Step 2: Same entity plus a new one (2x2 block)
    const grid2: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    detectEntities(grid2, tracker)
    stats = tracker.getStats()
    expect(stats.totalEntities).toBe(2) // E1 (single cell) + E2 (2x2 block)
    expect(stats.uniquePatterns).toBe(2)
    expect(stats.entitiesAlive).toBe(2)
    expect(stats.entitiesDied).toBe(0)

    // Step 3: First entity dies, second remains
    const grid3: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], // First entity gone
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0], // Second entity (block) remains
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    detectEntities(grid3, tracker)
    stats = tracker.getStats()
    expect(stats.totalEntities).toBe(2) // E1 (died) + E2 (still alive)
    expect(stats.uniquePatterns).toBe(2) // Still 2 unique patterns
    expect(stats.entitiesAlive).toBe(1)
    expect(stats.entitiesDied).toBe(1)
  })

  it('should reset statistics correctly', () => {
    const tracker = new EntityTracker()

    // Add some entities
    const grid: Grid = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ]

    detectEntities(grid, tracker)

    // Reset
    tracker.reset()

    const stats = tracker.getStats()
    expect(stats.totalEntities).toBe(0)
    expect(stats.uniquePatterns).toBe(0)
    expect(stats.entitiesAlive).toBe(0)
    expect(stats.entitiesDied).toBe(0)
  })

  it('should match statistics from test sequences', () => {
    interface TestSequenceWithStats {
      name: string
      description: string
      grids: Grid[]
      expectedEntities: any[]
      statistics: EntityStats
    }

    const sequencesWithStats = testData.sequences as TestSequenceWithStats[]

    sequencesWithStats.forEach((seq) => {
      const tracker = new EntityTracker()

      // Process all grids
      seq.grids.forEach((grid) => detectEntities(grid, tracker))

      const stats = tracker.getStats()

      // Verify statistics match expected values from test data
      expect(stats, `Statistics for ${seq.name} do not match`).toEqual(
        seq.statistics,
      )
    })
  })
})
