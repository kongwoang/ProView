import { Prisma } from '@prisma/client';
export interface ScoringCriterion {
  id: string;
  weight: Prisma.Decimal;
  scoreMin: Prisma.Decimal;
  scoreMax: Prisma.Decimal;
  required: boolean;
}
export function calculateGrade(
  criteria: ScoringCriterion[],
  scores: Map<string, number>,
): Prisma.Decimal | null {
  if (criteria.some((c) => c.required && !scores.has(c.id))) return null;
  let weighted = new Prisma.Decimal(0);
  let weights = new Prisma.Decimal(0);
  for (const criterion of criteria) {
    const score = scores.get(criterion.id);
    if (score === undefined) continue;
    const range = criterion.scoreMax.minus(criterion.scoreMin);
    if (range.lte(0) || criterion.weight.lt(0)) throw new Error('Invalid rubric');
    const normalized = new Prisma.Decimal(score).minus(criterion.scoreMin).dividedBy(range);
    if (normalized.lt(0) || normalized.gt(1)) throw new Error('Score outside criterion range');
    weighted = weighted.plus(normalized.times(criterion.weight));
    weights = weights.plus(criterion.weight);
  }
  return weights.gt(0) ? weighted.dividedBy(weights).times(10).toDecimalPlaces(2) : null;
}
