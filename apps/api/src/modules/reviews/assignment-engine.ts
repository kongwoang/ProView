/** Exact deterministic assignment search. A bounded search never misreports UNKNOWN as infeasible. */
export interface AssignmentInput {
  submissions: {
    id: string;
    authorGroupId: string;
    required: number;
    candidates: string[];
    fixed: string[];
  }[];
  reviewers: { id: string; workload: number }[];
  existingPairs: { reviewerGroupId: string; authorGroupId: string }[];
  maxNodes?: number;
}
export interface AssignmentResult {
  status: 'READY' | 'INFEASIBLE' | 'TIME_LIMIT';
  pairs: { submissionId: string; reviewerGroupId: string }[];
  objective: { reciprocalPairs: number; workloadRange: number; workloadSquares: number } | null;
  exploredNodes: number;
  workloadBefore: Record<string, number>;
  workloadAfter: Record<string, number>;
  unmetDemand: { submissionId: string; missing: number }[];
}
export function solveAssignments(input: AssignmentInput): AssignmentResult {
  const reviewers = [...input.reviewers].sort((a, b) => a.id.localeCompare(b.id));
  const before = Object.fromEntries(reviewers.map((r) => [r.id, r.workload]));
  const loads = { ...before };
  const edge = (a: string, b: string) => `${a}|${b}`;
  const edges = new Map<string, number>();
  for (const p of input.existingPairs)
    edges.set(
      edge(p.reviewerGroupId, p.authorGroupId),
      (edges.get(edge(p.reviewerGroupId, p.authorGroupId)) ?? 0) + 1,
    );
  const submissions = [...input.submissions]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      ...s,
      candidates: [...new Set(s.candidates)]
        .filter((r) => r !== s.authorGroupId && !s.fixed.includes(r) && r in loads)
        .sort(),
      missing: Math.max(0, s.required - s.fixed.length),
    }));
  const unmetDemand = submissions
    .filter((s) => s.candidates.length < s.missing)
    .map((s) => ({ submissionId: s.id, missing: s.missing - s.candidates.length }));
  if (unmetDemand.length)
    return {
      status: 'INFEASIBLE',
      pairs: [],
      objective: null,
      exploredNodes: 0,
      workloadBefore: before,
      workloadAfter: before,
      unmetDemand,
    };
  let exploredNodes = 0;
  let timedOut = false;
  let proven = false;
  let best: AssignmentResult['objective'] = null;
  let bestPairs: AssignmentResult['pairs'] = [];
  let bestLoads = { ...loads };
  const pairs: AssignmentResult['pairs'] = [];
  const added = submissions.reduce((sum, s) => sum + s.missing, 0);
  const idealLoads = Object.values(before).sort((a, b) => a - b);
  for (let n = 0; n < added; n++) {
    if (idealLoads.length) {
      idealLoads[0]!++;
      idealLoads.sort((a, b) => a - b);
    }
  }
  const idealSquares = idealLoads.reduce((sum, n) => sum + n * n, 0);
  const idealRange = idealLoads.length ? Math.max(...idealLoads) - Math.min(...idealLoads) : 0;
  const reciprocalCount = () =>
    [...edges.keys()].filter((k) => {
      const [a, b] = k.split('|') as [string, string];
      return a < b && edges.has(edge(b, a));
    }).length;
  const minimumReciprocal = reciprocalCount();
  function search(index: number) {
    if (timedOut || proven) return;
    if (++exploredNodes > (input.maxNodes ?? 1_000_000)) {
      timedOut = true;
      return;
    }
    if (best && reciprocalCount() > best.reciprocalPairs) return;
    if (index === submissions.length) {
      const values = Object.values(loads);
      const objective = {
        reciprocalPairs: reciprocalCount(),
        workloadRange: values.length ? Math.max(...values) - Math.min(...values) : 0,
        workloadSquares: values.reduce((sum, n) => sum + n * n, 0),
      };
      if (
        !best ||
        objective.reciprocalPairs < best.reciprocalPairs ||
        (objective.reciprocalPairs === best.reciprocalPairs &&
          (objective.workloadRange < best.workloadRange ||
            (objective.workloadRange === best.workloadRange &&
              objective.workloadSquares < best.workloadSquares)))
      ) {
        best = objective;
        bestPairs = pairs.map((p) => ({ ...p }));
        bestLoads = { ...loads };
        // Fixed reciprocal edges cannot disappear; water filling is a lower bound on any workload allocation.
        proven =
          objective.reciprocalPairs === minimumReciprocal &&
          objective.workloadRange === idealRange &&
          objective.workloadSquares === idealSquares;
      }
      return;
    }
    const s = submissions[index]!;
    function choose(start: number, remaining: number) {
      if (timedOut || proven) return;
      if (!remaining) {
        search(index + 1);
        return;
      }
      for (let i = start; i <= s.candidates.length - remaining; i++) {
        const reviewer = s.candidates[i]!;
        const key = edge(reviewer, s.authorGroupId);
        edges.set(key, (edges.get(key) ?? 0) + 1);
        loads[reviewer]!++;
        pairs.push({ submissionId: s.id, reviewerGroupId: reviewer });
        choose(i + 1, remaining - 1);
        pairs.pop();
        loads[reviewer]!--;
        const count = edges.get(key)! - 1;
        if (count) edges.set(key, count);
        else edges.delete(key);
      }
    }
    choose(0, s.missing);
  }
  search(0);
  return {
    status: timedOut ? 'TIME_LIMIT' : best ? 'READY' : 'INFEASIBLE',
    pairs: bestPairs,
    objective: best,
    exploredNodes,
    workloadBefore: before,
    workloadAfter: bestLoads,
    unmetDemand: [],
  };
}
