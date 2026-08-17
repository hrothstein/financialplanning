/**
 * Unit tests for the plan summary service (PRD §4.5).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { summarizePlan } from '../src/services/planSummaryService.js';

const asOf = new Date('2026-01-01T00:00:00Z');
const client = { clientId: 'C1', riskTolerance: 'MODERATE' };
const getClient = () => client;

// One clearly ON_TRACK goal (big savings, small target) and one OFF_TRACK.
const onTrackGoal = {
  goalId: 'GOAL-A', clientId: 'C1', type: 'EMERGENCY_FUND', name: 'Cushion', priority: 'MEDIUM',
  targetAmount: 20000, inTodaysDollars: false, targetDate: '2030-01-01',
  currentSavings: 25000, monthlyContribution: 0, expectedReturnRate: 0.05,
};
const offTrackGoal = {
  goalId: 'GOAL-B', clientId: 'C1', type: 'RETIREMENT', name: 'Retirement', priority: 'HIGH',
  targetAmount: 2000000, inTodaysDollars: false, targetDate: '2046-01-01',
  currentSavings: 10000, monthlyContribution: 100, expectedReturnRate: 0.06,
};

const plan = {
  planId: 'PLAN-A', clientId: 'C1', name: 'Test Plan', status: 'ACTIVE',
  goalIds: ['GOAL-A', 'GOAL-B'],
  assumptions: { inflationRate: 0.025, defaultReturnRate: 0.065, socialSecurityMonthly: 2000, lifeExpectancy: 90 },
};

test('summarizePlan counts statuses and aggregates totals', () => {
  const s = summarizePlan(plan, [onTrackGoal, offTrackGoal], getClient, { asOf });
  assert.equal(s.goalCount, 2);
  assert.equal(s.statusCounts.ON_TRACK, 1);
  assert.equal(s.statusCounts.OFF_TRACK, 1);
  assert.ok(s.totalTargetAmount > 0);
  assert.ok(s.totalProjectedAmount > 0);
  assert.ok(s.overallFundedPercentage > 0);
});

test('summarizePlan lists goals needing attention worst-first', () => {
  const s = summarizePlan(plan, [onTrackGoal, offTrackGoal], getClient, { asOf });
  assert.equal(s.goalsNeedingAttention.length, 1);
  assert.equal(s.goalsNeedingAttention[0].goalId, 'GOAL-B');
  assert.ok(s.goalsNeedingAttention[0].monthlyShortfall > 0);
  assert.ok(s.totalMonthlyShortfall > 0);
});

test('summarizePlan handles an empty plan', () => {
  const s = summarizePlan({ ...plan, goalIds: [] }, [], getClient, { asOf });
  assert.equal(s.goalCount, 0);
  assert.equal(s.overallFundedPercentage, 0);
  assert.deepEqual(s.goalsNeedingAttention, []);
});

test('summarizePlan uses plan inflation assumption for today\'s-dollar goals', () => {
  const todayGoal = { ...offTrackGoal, inTodaysDollars: true };
  const high = summarizePlan({ ...plan, assumptions: { ...plan.assumptions, inflationRate: 0.05 } }, [todayGoal], getClient, { asOf });
  const low = summarizePlan({ ...plan, assumptions: { ...plan.assumptions, inflationRate: 0.01 } }, [todayGoal], getClient, { asOf });
  // Higher inflation inflates the target more -> larger total target.
  assert.ok(high.totalTargetAmount > low.totalTargetAmount);
});
