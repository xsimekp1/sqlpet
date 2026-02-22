/**
 * Energy requirement calculations for shelter animals.
 *
 * RER (Resting Energy Requirement) = 70 × weight_kg^0.75 kcal/day
 * MER (Maintenance Energy Requirement) = RER × activity/status factor
 * 
 * Multipliers stack multiplicatively (matching Python mer_calculator.py):
 * - Base factor (age, species, altered status)
 * - pregnant × 1.5
 * - lactating × 2.0
 * - critical × 1.5
 * - diabetic × 1.0 (no change!)
 * - cancer × 1.35
 * 
 * Note: Only ONE health modifier is used at a time in Python!
 */

/**
 * Snap a gram value to a "nice" round number for feeding recommendations.
 * ≤ 200g  → nearest 10g
 * ≤ 300g  → nearest 20g
 * > 300g  → nearest 50g
 */
export function snapToNice(grams: number): number {
  if (grams <= 200) return Math.round(grams / 10) * 10;
  if (grams <= 300) return Math.round(grams / 20) * 20;
  return Math.round(grams / 50) * 50;
}

export function calcRER(weightKg: number): number {
  return Math.round(70 * Math.pow(weightKg, 0.75));
}

export function getMERFactor(
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean,
  isLactating: boolean,
  isCritical: boolean,
  isDiabetic: boolean,
  isCancer: boolean,
  species?: string,
): number {
  let factor = 1.0;
  
  // Health modifiers - only ONE is used at a time (matching Python behavior)
  // Priority: critical > cancer > lactating > pregnant > diabetic > healthy
  if (isCritical) {
    factor *= 1.5;
  } else if (isCancer) {
    factor *= 1.35;
  } else if (isLactating) {
    factor *= 2.0;
  } else if (isPregnant) {
    factor *= 1.5;
  } else if (isDiabetic) {
    factor *= 1.0; // No change - diabetes has 1.0 factor in Python!
  }
  
  // Base from age/species/alteration
  if (ageGroup === 'baby' || ageGroup === 'young') {
    factor *= species === 'cat' ? 2.5 : 3.0;
  } else if (ageGroup === 'senior') {
    factor *= species === 'cat' ? 1.1 : 1.4;
  } else {
    const isCat = species === 'cat';
    if (alteredStatus === 'neutered' || alteredStatus === 'spayed') {
      factor *= isCat ? 1.2 : 1.4;
    } else if (alteredStatus === 'unknown') {
      factor *= isCat ? 1.3 : 1.6;
    } else {
      factor *= isCat ? 1.4 : 1.8;
    }
  }
  
  return factor;
}

export function getMERFactorLabel(
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean,
  isLactating: boolean,
  isCritical: boolean,
  isDiabetic: boolean,
  isCancer: boolean,
  species?: string,
): string {
  const parts: string[] = [];
  
  // Health modifier (only one)
  if (isCritical) parts.push('Kritický: ×1.5');
  else if (isCancer) parts.push('Rakovina: ×1.35');
  else if (isLactating) parts.push('Kojící: ×2.0');
  else if (isPregnant) parts.push('Březí: ×1.5');
  else if (isDiabetic) parts.push('Diabetik: ×1.0');
  
  // Base from age/species/alteration
  if (ageGroup === 'baby' || ageGroup === 'young') {
    parts.push(species === 'cat' ? 'Koťátko: ×2.5' : 'Štěně: ×3.0');
  } else if (ageGroup === 'senior') {
    parts.push(species === 'cat' ? 'Senior: ×1.1' : 'Senior: ×1.4');
  } else {
    const isCat = species === 'cat';
    if (alteredStatus === 'neutered' || alteredStatus === 'spayed') {
      parts.push(isCat ? 'Kastrovaná: ×1.2' : 'Kastrovaný: ×1.4');
    } else if (alteredStatus === 'unknown') {
      parts.push(isCat ? 'Neznámá: ×1.3' : 'Neznámý: ×1.6');
    } else {
      parts.push(isCat ? 'Nekastrovaná: ×1.4' : 'Nekastrovaný: ×1.8');
    }
  }
  
  return parts.join(' × ');
}

export function calcMER(
  weightKg: number,
  ageGroup: string,
  alteredStatus: string,
  isPregnant: boolean,
  isLactating: boolean = false,
  isCritical: boolean = false,
  isDiabetic: boolean = false,
  isCancer: boolean = false,
  species?: string,
): number {
  return Math.round(calcRER(weightKg) * getMERFactor(ageGroup, alteredStatus, isPregnant, isLactating, isCritical, isDiabetic, isCancer, species));
}
