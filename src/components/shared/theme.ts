/**
 * Shared theme utilities for consistent color management across components.
 *
 * This module provides centralized theme color definitions to eliminate
 * duplication and ensure consistent theming throughout the application.
 */

export interface ThemeColors {
  /** Primary foreground color (violet-400 in dark mode, violet-600 in light) */
  fgColor: string
  /** Primary background color (gray-900 in dark mode, white in light) */
  bgColor: string
  /** Accent color (violet-600) */
  accentColor: string
}

/**
 * Get current theme colors based on document's dark mode class.
 *
 * @returns Theme colors object with foreground, background, and accent colors
 */
export function getCurrentThemeColors(): ThemeColors {
  const isDark = document.documentElement.classList.contains('dark')
  return {
    fgColor: isDark ? '#a78bfa' : '#9333ea', // violet-400 : violet-600
    bgColor: isDark ? '#111827' : '#ffffff', // gray-900 : white
    accentColor: '#8b5cf6', // violet-600
  }
}

/**
 * Get visualization color palette for cellular automata rendering.
 *
 * @param isDark - Whether to use dark mode palette
 * @returns Array of 9 hex color strings
 */
export function getVisualizationPalette(isDark: boolean): readonly string[] {
  return isDark ? DARK_PALETTE : LIGHT_PALETTE
}

/**
 * Dark mode color palette for cellular automata visualization.
 */
const DARK_PALETTE: readonly string[] = [
  '#dc2626', // red-600
  '#16a34a', // green-600
  '#9333ea', // purple-600
  '#ea580c', // orange-600
  '#0891b2', // cyan-600
  '#db2777', // pink-600
  '#65a30d', // lime-600
  '#7c3aed', // violet-600
  '#0d9488', // teal-600
]

/**
 * Light mode color palette for cellular automata visualization.
 */
const LIGHT_PALETTE: readonly string[] = [
  '#f87171', // red-400
  '#4ade80', // green-400
  '#c084fc', // purple-400
  '#fb923c', // orange-400
  '#22d3ee', // cyan-400
  '#f472b6', // pink-400
  '#a3e635', // lime-400
  '#a78bfa', // violet-400
  '#2dd4bf', // teal-400
]
