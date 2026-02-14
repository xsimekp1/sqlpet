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
  isPregnant: boolean,
  species?: string,
): number {
  if (isPregnant) return 2.5;
  if (ageGroup === 'baby' || ageGroup === 'young') return 2.5;
  if (ageGroup === 'senior') return 1.4;
  const isCat = species === 'cat';
  if (alteredStatus === 'neutered' || alteredStatus === 'spayed') return isCat ? 1.2 : 1.6;
  return isCat ? 1.4 : 1.8; // adult intact
}

export function getMERFactorLabel(
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean,
  species?: string,
): string {
  if (isPregnant) return 'Březí: RER × 2.5';
  if (ageGroup === 'baby' || ageGroup === 'young') return 'Mládě: RER × 2.5';
  if (ageGroup === 'senior') return 'Senior: RER × 1.4';
  const isCat = species === 'cat';
  if (alteredStatus === 'neutered' || alteredStatus === 'spayed') {
    return isCat ? 'Kastrovaná dospělá kočka: RER × 1.2' : 'Kastrovaný dospělý pes: RER × 1.6';
  }
  if (isCat) return 'Nekastrovaná kočka: RER × 1.4';
  return 'Nekastrovaný pes: RER × 1.8';
}

export function calcMER(
  weightKg: number,
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean,
  species?: string,
): number {
  return Math.round(calcRER(weightKg) * getMERFactor(ageGroup, alteredStatus, isPregnant, species));
}
