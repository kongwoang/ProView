import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AssignmentInput, solveAssignments } from '../src/modules/reviews/assignment-engine';
const complete = (n: number, required = 1): AssignmentInput => ({
  reviewers: Array.from({ length: n }, (_, i) => ({ id: String(i), workload: 0 })),
  submissions: Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    authorGroupId: String(i),
    required,
    candidates: Array.from({ length: n }, (_, j) => String(j)),
    fixed: [],
  })),
  existingPairs: [],
});
test('one group infeasible; two groups necessarily reciprocal', () => {
  assert.equal(solveAssignments(complete(1)).status, 'INFEASIBLE');
  const result = solveAssignments(complete(2));
  assert.equal(result.status, 'READY');
  assert.equal(result.objective?.reciprocalPairs, 1);
});
test('three+ groups obtain deterministic nonreciprocal balanced assignments', () => {
  for (const n of [3, 4, 5, 8]) {
    const result = solveAssignments(complete(n));
    assert.equal(result.status, 'READY');
    assert.equal(result.objective?.reciprocalPairs, 0);
    assert.equal(result.objective?.workloadRange, 0);
    assert.deepEqual(result, solveAssignments(complete(n)));
    assert.equal(result.pairs.length, n);
  }
});
test('quota not silently reduced and timeout is distinct from infeasible', () => {
  assert.equal(solveAssignments(complete(3, 3)).status, 'INFEASIBLE');
  assert.equal(solveAssignments({ ...complete(8), maxNodes: 1 }).status, 'TIME_LIMIT');
});
test('fixed work cannot be replaced; balances additional assignments', () => {
  const input = complete(4);
  input.submissions[0]!.fixed = ['1'];
  input.existingPairs.push({ reviewerGroupId: '1', authorGroupId: '0' });
  input.reviewers[1]!.workload = 1;
  const result = solveAssignments(input);
  assert.equal(result.status, 'READY');
  assert.equal(result.pairs.length, 3);
  assert.ok(!result.pairs.some((p) => p.submissionId === 's0'));
  assert.equal(result.objective?.reciprocalPairs, 0);
  assert.equal(result.objective?.workloadRange, 0);
});
test('exhaustive independent small-graph oracle agrees on reciprocity/workload objective', () => {
  const n = 4;
  for (let mask = 0; mask < 64; mask++) {
    const input = complete(n);
    input.submissions.forEach((s, index) => {
      s.candidates = s.candidates.filter(
        (r) =>
          r !== s.authorGroupId &&
          !((mask >> index) & 1 && Number(r) === (index + 1 + ((mask >> 4) & 1)) % n),
      );
    });
    let best: number[] | null = null;
    const selected: string[] = [];
    function oracle(i: number) {
      if (i < n) {
        for (const r of input.submissions[i]!.candidates) {
          selected.push(r);
          oracle(i + 1);
          selected.pop();
        }
        return;
      }
      let reciprocal = 0;
      for (let a = 0; a < n; a++)
        for (let b = a + 1; b < n; b++)
          if (selected[a] === String(b) && selected[b] === String(a)) reciprocal++;
      const loads = Array.from(
        { length: n },
        (_, reviewer) => selected.filter((r) => r === String(reviewer)).length,
      );
      const objective = [
        reciprocal,
        Math.max(...loads) - Math.min(...loads),
        loads.reduce((s, l) => s + l * l, 0),
      ];
      if (
        !best ||
        objective.some(
          (v, j) => v < best![j]! && objective.slice(0, j).every((w, k) => w === best![k]),
        )
      )
        best = objective;
    }
    oracle(0);
    const result = solveAssignments(input);
    assert.equal(result.status, best ? 'READY' : 'INFEASIBLE');
    if (best)
      assert.deepEqual(
        [
          result.objective?.reciprocalPairs,
          result.objective?.workloadRange,
          result.objective?.workloadSquares,
        ],
        best,
        `mask=${mask}`,
      );
  }
});
