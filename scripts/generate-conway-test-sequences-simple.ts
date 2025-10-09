import fs from 'node:fs'
import path from 'node:path'
import { normalizePattern } from '../src/entityDetection'

type Grid = (0 | 1)[][]

// Conway's Game of Life rules
function countNeighbors(grid: Grid, x: number, y: number): number {
  const height = grid.length
  const width = grid[0].length
  let count = 0

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue

      const ny = (((y + dy) % height) + height) % height
      const nx = (((x + dx) % width) + width) % width

      if (grid[ny][nx] === 1) {
        count++
      }
    }
  }

  return count
}

function step(grid: Grid): Grid {
  const height = grid.length
  const width = grid[0].length
  const newGrid: Grid = []

  for (let y = 0; y < height; y++) {
    const row: (0 | 1)[] = []
    for (let x = 0; x < width; x++) {
      const neighbors = countNeighbors(grid, x, y)
      const current = grid[y][x]

      if (current === 1) {
        // Cell is alive
        row.push(neighbors === 2 || neighbors === 3 ? 1 : 0)
      } else {
        // Cell is dead
        row.push(neighbors === 3 ? 1 : 0)
      }
    }
    newGrid.push(row)
  }

  return newGrid
}

interface EntityInfo {
  cells: Array<{ x: number; y: number }>
  id: string // Entity identity that should be preserved across steps
}

interface EntityStatistics {
  totalEntities: number
  uniquePatterns: number
  entitiesAlive: number
  entitiesDied: number
}

interface TestSequence {
  name: string
  description: string
  grids: Grid[]
  expectedEntities: EntityInfo[][] // For each grid, what entities should be found
  statistics: EntityStatistics // Final statistics after all steps
}

// Helper to create test sequences
function createTestSequence(
  name: string,
  description: string,
  initial: Grid,
  steps: number,
  entityGenerator: (stepIndex: number) => EntityInfo[],
): TestSequence {
  const grids: Grid[] = [initial]
  let current = initial

  for (let i = 0; i < steps; i++) {
    current = step(current)
    grids.push(current)
  }

  const expectedEntities = grids.map((_, index) => entityGenerator(index))

  // Calculate statistics
  const allEntityIds = new Set<string>()
  const lastStepIds = new Set<string>()
  const uniqueEntityPatterns = new Map<string, Set<string>>() // entityId -> set of unique patterns for that entity

  // Track all unique entity IDs and patterns
  for (const stepEntities of expectedEntities) {
    for (const entity of stepEntities) {
      allEntityIds.add(entity.id)

      // Track unique patterns per entity ID
      if (!uniqueEntityPatterns.has(entity.id)) {
        uniqueEntityPatterns.set(entity.id, new Set())
      }

      // Use the same normalization as EntityTracker
      const normalizedPattern = normalizePattern(entity.cells)
      uniqueEntityPatterns.get(entity.id)?.add(normalizedPattern)
    }
  }

  // Track entities alive in the last step
  const lastStepEntities = expectedEntities[expectedEntities.length - 1]
  for (const entity of lastStepEntities) {
    lastStepIds.add(entity.id)
  }

  // Calculate how many died (appeared at some point but not in the last step)
  const deadEntityIds = new Set<string>()
  for (const id of allEntityIds) {
    if (!lastStepIds.has(id)) {
      deadEntityIds.add(id)
    }
  }

  // Count total unique patterns across all entities
  const allUniquePatterns = new Set<string>()
  for (const patterns of uniqueEntityPatterns.values()) {
    for (const p of patterns) {
      allUniquePatterns.add(p)
    }
  }

  const statistics: EntityStatistics = {
    totalEntities: allEntityIds.size,
    uniquePatterns: allUniquePatterns.size,
    entitiesAlive: lastStepIds.size,
    entitiesDied: deadEntityIds.size,
  }

  return { name, description, grids, expectedEntities, statistics }
}

// Test sequences
const sequences: TestSequence[] = [
  // Blinker
  createTestSequence(
    'blinker',
    'Single blinker oscillating between horizontal and vertical',
    [
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
    ],
    3,
    (step) => {
      if (step % 2 === 0) {
        // Horizontal
        return [
          {
            cells: [
              { x: 3, y: 3 },
              { x: 4, y: 3 },
              { x: 5, y: 3 },
            ],
            id: 'E1',
          },
        ]
      }
      // Vertical
      return [
        {
          cells: [
            { x: 4, y: 2 },
            { x: 4, y: 3 },
            { x: 4, y: 4 },
          ],
          id: 'E1', // Same ID - it's the same entity
        },
      ]
    },
  ),

  // Block
  createTestSequence(
    'block',
    'Single 2x2 block (still life)',
    [
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
    ],
    2,
    () => [
      {
        cells: [
          { x: 3, y: 2 },
          { x: 4, y: 2 },
          { x: 3, y: 3 },
          { x: 4, y: 3 },
        ],
        id: 'E1',
      },
    ],
  ),

  // Two entities
  createTestSequence(
    'twoEntities',
    'One blinker and one block',
    [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 0, 0, 0], // Blinker
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0], // Block
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    3,
    (step) => {
      const block = {
        cells: [
          { x: 6, y: 6 },
          { x: 7, y: 6 },
          { x: 6, y: 7 },
          { x: 7, y: 7 },
        ],
        id: 'E2',
      }

      if (step % 2 === 0) {
        // Blinker horizontal
        return [
          {
            cells: [
              { x: 1, y: 2 },
              { x: 2, y: 2 },
              { x: 3, y: 2 },
            ],
            id: 'E1',
          },
          block,
        ]
      }
      // Blinker vertical
      return [
        {
          cells: [
            { x: 2, y: 1 },
            { x: 2, y: 2 },
            { x: 2, y: 3 },
          ],
          id: 'E1',
        },
        block,
      ]
    },
  ),

  // Toad
  createTestSequence(
    'toad',
    'Toad oscillator (period 2)',
    [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    3,
    (step) => {
      if (step % 2 === 0) {
        // Phase 1
        return [
          {
            cells: [
              { x: 4, y: 4 },
              { x: 5, y: 4 },
              { x: 6, y: 4 },
              { x: 3, y: 5 },
              { x: 4, y: 5 },
              { x: 5, y: 5 },
            ],
            id: 'E1', // Same entity across phases
          },
        ]
      }
      // Phase 2 - cells are disconnected, so no entity is detected
      return []
    },
  ),

  // Entity death with other entities present
  createTestSequence(
    'entityDeath',
    'One entity dies while others survive - tests ID preservation',
    [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0], // These two cells will die (too few neighbors)
      [0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0], // Block (will survive)
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 1, 0, 0, 0, 0, 0, 0], // Blinker (will survive)
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ],
    4,
    (step) => {
      if (step === 0) {
        // Initial state: 3 entities
        return [
          {
            cells: [
              { x: 2, y: 1 },
              { x: 2, y: 2 },
            ],
            id: 'E1',
          }, // Vertical pair (will die)
          {
            cells: [
              { x: 6, y: 5 },
              { x: 7, y: 5 },
              { x: 6, y: 6 },
              { x: 7, y: 6 },
            ],
            id: 'E2',
          }, // Block
          {
            cells: [
              { x: 1, y: 8 },
              { x: 2, y: 8 },
              { x: 3, y: 8 },
            ],
            id: 'E3',
          }, // Blinker
        ]
      }
      if (step === 1) {
        // E1 died, E2 and E3 survive (E3 transforms to vertical)
        return [
          {
            cells: [
              { x: 6, y: 5 },
              { x: 7, y: 5 },
              { x: 6, y: 6 },
              { x: 7, y: 6 },
            ],
            id: 'E2',
          }, // Block unchanged
          {
            cells: [
              { x: 2, y: 7 },
              { x: 2, y: 8 },
              { x: 2, y: 9 },
            ],
            id: 'E3',
          }, // Blinker vertical
        ]
      }
      if (step === 2) {
        // E2 and E3 continue (E3 back to horizontal)
        return [
          {
            cells: [
              { x: 6, y: 5 },
              { x: 7, y: 5 },
              { x: 6, y: 6 },
              { x: 7, y: 6 },
            ],
            id: 'E2',
          },
          {
            cells: [
              { x: 1, y: 8 },
              { x: 2, y: 8 },
              { x: 3, y: 8 },
            ],
            id: 'E3',
          }, // Blinker horizontal
        ]
      }
      if (step === 3) {
        // E2 and E3 continue (E3 vertical again)
        return [
          {
            cells: [
              { x: 6, y: 5 },
              { x: 7, y: 5 },
              { x: 6, y: 6 },
              { x: 7, y: 6 },
            ],
            id: 'E2',
          },
          {
            cells: [
              { x: 2, y: 7 },
              { x: 2, y: 8 },
              { x: 2, y: 9 },
            ],
            id: 'E3',
          }, // Blinker vertical
        ]
      }
      // E2 and E3 continue (E3 horizontal)
      return [
        {
          cells: [
            { x: 6, y: 5 },
            { x: 7, y: 5 },
            { x: 6, y: 6 },
            { x: 7, y: 6 },
          ],
          id: 'E2',
        },
        {
          cells: [
            { x: 1, y: 8 },
            { x: 2, y: 8 },
            { x: 3, y: 8 },
          ],
          id: 'E3',
        }, // Blinker horizontal
      ]
    },
  ),
]

// Custom JSON stringifier for readable grids
function stringifyOutput(sequences: TestSequence[]): string {
  let result = '{\n  "sequences": [\n'

  sequences.forEach((seq, seqIndex) => {
    result += '    {\n'
    result += `      "name": "${seq.name}",\n`
    result += `      "description": "${seq.description}",\n`
    result += `      "grids": [\n`

    seq.grids.forEach((grid, gridIndex) => {
      result += '        [\n'
      grid.forEach((row, rowIndex) => {
        result += `          [${row.join(',')}]`
        if (rowIndex < grid.length - 1) result += ','
        result += '\n'
      })
      result += '        ]'
      if (gridIndex < seq.grids.length - 1) result += ','
      result += '\n'
    })

    result += '      ],\n'
    result += '      "expectedEntities": [\n'

    seq.expectedEntities.forEach((entities, stepIndex) => {
      result += '        [\n'
      entities.forEach((entity, entityIndex) => {
        result += '          {\n'
        result += '            "cells": [\n'
        entity.cells.forEach((cell, cellIndex) => {
          result += `              {"x": ${cell.x}, "y": ${cell.y}}`
          if (cellIndex < entity.cells.length - 1) result += ','
          result += '\n'
        })
        result += '            ],\n'
        result += `            "id": "${entity.id}"\n`
        result += '          }'
        if (entityIndex < entities.length - 1) result += ','
        result += '\n'
      })
      result += '        ]'
      if (stepIndex < seq.expectedEntities.length - 1) result += ','
      result += '\n'
    })

    result += '      ],\n'
    result += '      "statistics": {\n'
    result += `        "totalEntities": ${seq.statistics.totalEntities},\n`
    result += `        "uniquePatterns": ${seq.statistics.uniquePatterns},\n`
    result += `        "entitiesAlive": ${seq.statistics.entitiesAlive},\n`
    result += `        "entitiesDied": ${seq.statistics.entitiesDied}\n`
    result += '      }\n'
    result += '    }'
    if (seqIndex < sequences.length - 1) result += ','
    result += '\n'
  })

  result += '  ]\n}\n'
  return result
}

// Output
const outputPath = path.join(
  process.cwd(),
  'resources',
  'conway-test-sequences-detailed.json',
)
fs.writeFileSync(outputPath, stringifyOutput(sequences))

console.log(`Generated detailed test sequences to ${outputPath}`)
console.log('Sequences generated:')
for (const seq of sequences) {
  console.log(`- ${seq.name}: ${seq.description} (${seq.grids.length} grids)`)
}
