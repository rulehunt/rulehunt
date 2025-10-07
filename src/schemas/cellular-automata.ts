import { z } from 'zod';

// Cell state primitives
export const CellState = z.union([
  z.literal(0),
  z.literal(1),
]);

export const ExtendedCellState = z.number().int().min(0).max(255);

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

export const ExtendedGrid = z.array(z.array(ExtendedCellState));

// Neighborhood types
export const NeighborhoodType = z.enum([
  'moore', // 8 neighbors
  'vonNeumann', // 4 neighbors
  'hexagonal', // 6 neighbors
]);

// Rule definitions
export const ConwayRule = z.object({
  birth: z.array(z.number().int().min(0).max(8)),
  survival: z.array(z.number().int().min(0).max(8)),
});

export const ElementaryRule = z.number().int().min(0).max(255);

export const TotalisticRule = z.object({
  states: z.number().int().min(2),
  transitions: z.record(z.string(), z.number().int()),
});

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
  rule: z.union([
    z.object({ type: z.literal('conway'), config: ConwayRule }),
    z.object({ type: z.literal('elementary'), config: ElementaryRule }),
    z.object({ type: z.literal('totalistic'), config: TotalisticRule }),
  ]),
  neighborhoodType: NeighborhoodType.default('moore'),
  boundaryCondition: z.enum(['periodic', 'fixed', 'reflective']).default('periodic'),
  speed: z.number().positive().default(1),
});

// Type exports
export type CellState = z.infer<typeof CellState>;
export type ExtendedCellState = z.infer<typeof ExtendedCellState>;
export type Coordinate = z.infer<typeof Coordinate>;
export type Cell = z.infer<typeof Cell>;
export type GridDimensions = z.infer<typeof GridDimensions>;
export type Grid = z.infer<typeof Grid>;
export type ExtendedGrid = z.infer<typeof ExtendedGrid>;
export type NeighborhoodType = z.infer<typeof NeighborhoodType>;
export type ConwayRule = z.infer<typeof ConwayRule>;
export type ElementaryRule = z.infer<typeof ElementaryRule>;
export type TotalisticRule = z.infer<typeof TotalisticRule>;
export type Pattern = z.infer<typeof Pattern>;
export type SimulationConfig = z.infer<typeof SimulationConfig>;