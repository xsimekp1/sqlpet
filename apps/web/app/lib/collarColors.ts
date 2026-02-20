/**
 * Collar color utilities for litter identification
 *
 * 8 colors maximum for visual distinction
 */

export type CollarColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'orange'
  | 'purple'
  | 'pink'
  | 'brown'

export const COLLAR_COLORS: CollarColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'orange',
  'purple',
  'pink',
  'brown',
]

/**
 * Color configuration with hex, Tailwind classes, and display names
 */
export const COLLAR_COLOR_CONFIG: Record<CollarColor, {
  hex: string
  bg: string        // Tailwind background class
  border: string    // Tailwind border class
  text: string      // Tailwind text class
  darkBg: string    // Dark mode background
}> = {
  red: {
    hex: '#ef4444',
    bg: 'bg-red-500',
    border: 'border-red-500',
    text: 'text-red-700',
    darkBg: 'dark:bg-red-600',
  },
  blue: {
    hex: '#3b82f6',
    bg: 'bg-blue-500',
    border: 'border-blue-500',
    text: 'text-blue-700',
    darkBg: 'dark:bg-blue-600',
  },
  green: {
    hex: '#22c55e',
    bg: 'bg-green-500',
    border: 'border-green-500',
    text: 'text-green-700',
    darkBg: 'dark:bg-green-600',
  },
  yellow: {
    hex: '#eab308',
    bg: 'bg-yellow-500',
    border: 'border-yellow-500',
    text: 'text-yellow-700',
    darkBg: 'dark:bg-yellow-600',
  },
  orange: {
    hex: '#f97316',
    bg: 'bg-orange-500',
    border: 'border-orange-500',
    text: 'text-orange-700',
    darkBg: 'dark:bg-orange-600',
  },
  purple: {
    hex: '#a855f7',
    bg: 'bg-purple-500',
    border: 'border-purple-500',
    text: 'text-purple-700',
    darkBg: 'dark:bg-purple-600',
  },
  pink: {
    hex: '#ec4899',
    bg: 'bg-pink-500',
    border: 'border-pink-500',
    text: 'text-pink-700',
    darkBg: 'dark:bg-pink-600',
  },
  brown: {
    hex: '#92400e',
    bg: 'bg-amber-800',
    border: 'border-amber-800',
    text: 'text-amber-900',
    darkBg: 'dark:bg-amber-700',
  },
}

/**
 * Get collar color configuration
 */
export function getCollarColor(color: string | null | undefined) {
  if (!color || !isValidCollarColor(color)) {
    return null
  }
  return COLLAR_COLOR_CONFIG[color as CollarColor]
}

/**
 * Check if string is a valid collar color
 */
export function isValidCollarColor(color: string): color is CollarColor {
  return COLLAR_COLORS.includes(color as CollarColor)
}

/**
 * Auto-assign collar colors to litter
 * Uses round-robin from available colors
 *
 * @param litterSize - Number of puppies/kittens in litter
 * @returns Array of collar colors to assign
 */
export function assignLitterColors(litterSize: number): CollarColor[] {
  const colors: CollarColor[] = []

  for (let i = 0; i < litterSize; i++) {
    // Round-robin through colors
    const colorIndex = i % COLLAR_COLORS.length
    colors.push(COLLAR_COLORS[colorIndex])
  }

  return colors
}

/**
 * Check if litter has duplicate colors (warning)
 */
export function hasCollarDuplicates(colors: (CollarColor | null)[]): boolean {
  const nonNullColors = colors.filter(c => c !== null) as CollarColor[]
  return nonNullColors.length > COLLAR_COLORS.length
}
