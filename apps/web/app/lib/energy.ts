/**
 * Energy requirement calculations for shelter animals.
 *
 * RER (Resting Energy Requirement) = 70 × weight_kg^0.75 kcal/day
 * MER (Maintenance Energy Requirement) = RER × activity/status factor
 */

export function calcRER(weightKg: number): number {
  return Math.round(70 * Math.pow(weightKg, 0.75));
}

export function getMERFactor(
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean
): number {
  if (isPregnant) return 2.5;
  if (ageGroup === 'baby' || ageGroup === 'young') return 2.5;
  if (ageGroup === 'senior') return 1.4;
  if (alteredStatus === 'neutered' || alteredStatus === 'spayed') return 1.6;
  return 1.8; // adult intact
}

export function calcMER(
  weightKg: number,
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean
): number {
  return Math.round(calcRER(weightKg) * getMERFactor(ageGroup, alteredStatus, isPregnant));
}
