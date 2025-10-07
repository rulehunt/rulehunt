import { z } from 'zod';

export const C4PatternSchema = z.object({
  value: z.number(),
  binary: z.string(),
  grid: z.array(z.array(z.number())),
  gridString: z.string(),
});

export const C4OrbitSchema = z.object({
  id: z.number(),
  representative: z.number(),
  size: z.number(),
  patterns: z.array(C4PatternSchema),
});

export const C4OrbitsFileSchema = z.object({
  summary: z.object({
    totalOrbits: z.number(),
    orbitSizeDistribution: z.record(z.string(), z.number()),
    totalPatterns: z.number(),
  }),
  orbits: z.array(C4OrbitSchema),
});

export type C4Pattern = z.infer<typeof C4PatternSchema>;
export type C4Orbit = z.infer<typeof C4OrbitSchema>;
export type C4OrbitsFile = z.infer<typeof C4OrbitsFileSchema>;