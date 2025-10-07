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

export const Pattern = z.array(z.array(CellState).length(3)).length(3);

// Individual 3x3 convolution rule
// Maps a canonical pattern to output state (alive/dead)
export const Rule = z.object({
  pattern: Pattern,
  output: CellState,
});

export const Ruleset = z.array(CellState).refine(
  (array) => array.length === 512,
  { message: "Ruleset must define output for all 512 canonical patterns" }
);

// Pattern definitions
export const GridPattern = z.object({
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
    GridPattern,
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
export type Rule = z.infer<typeof Rule>;
export type Ruleset = z.infer<typeof Ruleset>;
export type Pattern = z.infer<typeof Pattern>;
export type SimulationConfig = z.infer<typeof SimulationConfig>;