import { z } from 'zod';

// Cell state primitives
export const CellState = z.union([
  z.literal(0),
  z.literal(1),
]);

// Coordinates
export const Coordinate = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

// Cell with position and state
export const Cell = z.object({
  position: Coordinate,
  state: CellState,
});

// Grid dimensions
export const GridDimensions = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

// Grid/Board schemas
export const Grid = z.array(z.array(CellState));

// Canonical pattern index (0-127) representing a C4 symmetry equivalence class
export const CanonicalPatternIndex = z.number().int().min(0).max(127);

// Individual 3x3 convolution rule
// Maps a canonical pattern to output state (alive/dead)
export const Rule = z.object({
  canonicalIndex: CanonicalPatternIndex,
  pattern: z.array(z.array(CellState).length(3)).length(3), // The canonical representation
  output: CellState,
});

// Complete ruleset with C4 symmetry as a map from canonical index to output
// Using a Record ensures each canonical pattern appears exactly once
export const Ruleset = z.record(
  z.string().regex(/^(12[0-7]|1[01][0-9]|[1-9]?[0-9])$/), // "0" to "127" as strings
  CellState
).refine(
  (record) => Object.keys(record).length === 128,
  { message: "Ruleset must define output for all 128 canonical patterns" }
);

// Pattern definitions
export const Pattern = z.object({
  name: z.string(),
  description: z.string().optional(),
  cells: z.array(Coordinate),
});

// Simulation configuration
export const SimulationConfig = z.object({
  dimensions: GridDimensions,
  initialState: z.union([
    z.literal('random'),
    z.literal('empty'),
    Pattern,
    Grid,
  ]),
  ruleset: Ruleset,
});

// Type exports
export type CellState = z.infer<typeof CellState>;
export type Coordinate = z.infer<typeof Coordinate>;
export type Cell = z.infer<typeof Cell>;
export type GridDimensions = z.infer<typeof GridDimensions>;
export type Grid = z.infer<typeof Grid>;
export type CanonicalPatternIndex = z.infer<typeof CanonicalPatternIndex>;
export type Rule = z.infer<typeof Rule>;
export type Ruleset = z.infer<typeof Ruleset>;
export type Pattern = z.infer<typeof Pattern>;
export type SimulationConfig = z.infer<typeof SimulationConfig>;