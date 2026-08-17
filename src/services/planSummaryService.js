/**
 * Plan summary aggregation (PRD §4.5).
 *
 * Rolls up the deterministic projections for every goal in a plan: counts by
 * status, total target vs. total projected, overall funded %, and a
 * prioritized list of at-risk / off-track goals with their contribution gap.
 *
 * Pure: callers pass the plan, its goals, and a client lookup; this module
 * does not touch the store.
 */

import { projectGoal } from './projectionEngine.js';

function round(value, dp = 2) {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

/** Order used when prioritizing which goals to fix first. */
const PRIORITY_RANK = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const STATUS_RANK = { OFF_TRACK: 0, AT_RISK: 1, ON_TRACK: 2 };

/**
 * Build an aggregate summary for a plan.
 *
 * @param {object} plan    the plan entity
 * @param {Array<object>} goals the goal entities referenced by the plan
 * @param {(clientId:string)=>object} getClient resolves a client for return defaults
 * @param {object} [opts] passed through to projectGoal (asOf, inflationRate)
 */
export function summarizePlan(plan, goals, getClient, opts = {}) {
  // Honor a plan-level inflation assumption if one is set, unless overridden.
  const inflationRate = opts.inflationRate ?? plan.assumptions?.inflationRate;
  const projectionOpts = { ...opts, ...(inflationRate != null ? { inflationRate } : {}) };

  const statusCounts = { ON_TRACK: 0, AT_RISK: 0, OFF_TRACK: 0 };
  let totalTarget = 0;
  let totalProjected = 0;
  const goalSummaries = [];

  for (const goal of goals) {
    const client = getClient(goal.clientId);
    const projection = projectGoal(goal, client, projectionOpts);

    statusCounts[projection.status] += 1;
    totalTarget += projection.adjustedTargetAmount;
    totalProjected += projection.projectedAmount;

    goalSummaries.push({
      goalId: goal.goalId,
      name: goal.name,
      type: goal.type,
      priority: goal.priority,
      status: projection.status,
      adjustedTargetAmount: projection.adjustedTargetAmount,
      projectedAmount: projection.projectedAmount,
      fundedPercentage: projection.fundedPercentage,
      currentMonthlyContribution: projection.currentMonthlyContribution,
      requiredMonthlyContribution: projection.requiredMonthlyContribution,
      monthlyShortfall: projection.monthlyShortfall,
    });
  }

  const overallFundedPercentage = totalTarget > 0 ? totalProjected / totalTarget : 0;

  // Goals needing attention, worst first, then by client priority, then by
  // the size of the monthly funding gap.
  const attention = goalSummaries
    .filter((g) => g.status !== 'ON_TRACK')
    .sort(
      (a, b) =>
        STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        b.monthlyShortfall - a.monthlyShortfall,
    );

  const totalMonthlyShortfall = attention.reduce((sum, g) => sum + g.monthlyShortfall, 0);

  return {
    planId: plan.planId,
    clientId: plan.clientId,
    name: plan.name,
    status: plan.status,
    goalCount: goals.length,
    statusCounts,
    totalTargetAmount: round(totalTarget),
    totalProjectedAmount: round(totalProjected),
    overallFundedPercentage: round(overallFundedPercentage, 3),
    totalMonthlyShortfall: round(totalMonthlyShortfall),
    goalsNeedingAttention: attention,
    goals: goalSummaries,
  };
}
