import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { Prisma } from '@prisma/client';
import { calculateGrade } from '../src/modules/grades/scoring';
const c = (id: string, min: number, max: number, weight: number, required = true) => ({
  id,
  scoreMin: new Prisma.Decimal(min),
  scoreMax: new Prisma.Decimal(max),
  weight: new Prisma.Decimal(weight),
  required,
});
test('mixed rubric ranges normalize to the instructor grade scale', () => {
  const criteria = [c('quality', 1, 5, 3), c('documentation', 0, 100, 1)];
  assert.equal(
    calculateGrade(
      criteria,
      new Map([
        ['quality', 3],
        ['documentation', 100],
      ]),
    )?.toString(),
    '6.25',
  );
});
test('incomplete required criteria are not publishable', () => {
  assert.equal(calculateGrade([c('a', 0, 10, 1), c('b', 0, 10, 1)], new Map([['a', 8]])), null);
});
test('boundary scores produce the full 0–10 scale', () => {
  assert.equal(calculateGrade([c('a', -5, 5, 1)], new Map([['a', -5]]))?.toNumber(), 0);
  assert.equal(calculateGrade([c('a', -5, 5, 1)], new Map([['a', 5]]))?.toNumber(), 10);
});
test('invalid ranges and out-of-range scores are rejected', () => {
  assert.throws(() => calculateGrade([c('a', 0, 0, 1)], new Map([['a', 0]])));
  assert.throws(() => calculateGrade([c('a', 0, 10, 1)], new Map([['a', 11]])));
  assert.throws(() => calculateGrade([c('a', 0, 10, -1)], new Map([['a', 5]])));
});
