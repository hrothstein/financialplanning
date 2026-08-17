/**
 * Unit tests for the operations layer (shared by REST + MCP).
 * Covers CRUD happy paths, validation errors, seed integrity, and reset.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { reset, store } from '../src/data/store.js';
import * as ops from '../src/lib/operations.js';
import { ApiError } from '../src/lib/errors.js';

// Reseed before each test so state is isolated.
test.beforeEach(() => reset());

test('seed produces the expected volume of data', () => {
  const counts = reset();
  assert.equal(counts.clients, 50);
  assert.ok(counts.goals >= 100 && counts.goals <= 160, `goals ${counts.goals} in range`);
  assert.equal(counts.plans, 40);
  assert.ok(counts.items >= 150, `items ${counts.items}`);
});

test('seed is deterministic across resets', () => {
  reset();
  const g1 = store.goals.get('GOAL-00001');
  reset();
  const g2 = store.goals.get('GOAL-00001');
  assert.deepEqual(g1, g2);
});

test('seed contains all three goal statuses', () => {
  const goals = ops.listGoals();
  const statuses = new Set(goals.map((g) => g.status));
  assert.ok(statuses.has('ON_TRACK'));
  assert.ok(statuses.has('AT_RISK'));
  assert.ok(statuses.has('OFF_TRACK'));
});

test('showcase CUST-001 has an AT_RISK retirement and ON_TRACK college', () => {
  const goals = ops.listGoals({ clientId: 'CUST-001' });
  const retirement = goals.find((g) => g.type === 'RETIREMENT');
  const college = goals.find((g) => g.type === 'EDUCATION');
  assert.equal(retirement.status, 'AT_RISK');
  assert.equal(college.status, 'ON_TRACK');
});

test('listClients filters by risk tolerance', () => {
  const conservative = ops.listClients({ riskTolerance: 'CONSERVATIVE' });
  assert.ok(conservative.every((c) => c.riskTolerance === 'CONSERVATIVE'));
});

test('getClient throws ApiError(404) for unknown client', () => {
  assert.throws(() => ops.getClient('CUST-999'), (e) => e instanceof ApiError && e.status === 404);
});

test('createGoal defaults expectedReturnRate from risk tolerance', () => {
  const client = ops.listClients({ riskTolerance: 'AGGRESSIVE' })[0];
  const goal = ops.createGoal({
    clientId: client.clientId, type: 'HOME_PURCHASE', name: 'New Home',
    targetAmount: 100000, targetDate: '2032-01-01',
  });
  assert.equal(goal.expectedReturnRate, 0.085);
  assert.ok(goal.goalId.startsWith('GOAL-'));
  assert.ok(['ON_TRACK', 'AT_RISK', 'OFF_TRACK'].includes(goal.status));
});

test('createGoal validates required fields and enums', () => {
  assert.throws(() => ops.createGoal({ type: 'RETIREMENT', name: 'x', targetAmount: 1, targetDate: '2030-01-01' }),
    (e) => e instanceof ApiError && e.status === 400); // missing clientId
  assert.throws(() => ops.createGoal({ clientId: 'CUST-001', type: 'NOPE', name: 'x', targetAmount: 1, targetDate: '2030-01-01' }),
    (e) => e instanceof ApiError && e.code === 'BAD_REQUEST'); // bad enum
  assert.throws(() => ops.createGoal({ clientId: 'CUST-001', type: 'RETIREMENT', name: 'x', targetAmount: 1, targetDate: 'not-a-date' }),
    (e) => e instanceof ApiError); // bad date
});

test('updateGoal recomputes status and bumps updatedAt', () => {
  const goal = ops.listGoals({ clientId: 'CUST-001' })[0];
  const updated = ops.updateGoal(goal.goalId, { monthlyContribution: goal.monthlyContribution + 100000 });
  assert.equal(updated.status, 'ON_TRACK'); // massive contribution -> funded
  assert.notEqual(updated.updatedAt, goal.updatedAt);
});

test('deleteGoal removes the goal and detaches it from plans', () => {
  const plan = ops.listPlans({ clientId: 'CUST-001' })[0];
  const goalId = plan.goalIds[0];
  ops.deleteGoal(goalId);
  assert.throws(() => ops.getGoal(goalId), (e) => e instanceof ApiError && e.status === 404);
  const after = ops.getPlan(plan.planId);
  assert.ok(!after.goalIds.includes(goalId));
});

test('createPlan rejects goals from another client', () => {
  const otherGoal = ops.listGoals({ clientId: 'CUST-002' })[0];
  assert.throws(
    () => ops.createPlan({ clientId: 'CUST-001', name: 'X', goalIds: [otherGoal.goalId] }),
    (e) => e instanceof ApiError && e.status === 400,
  );
});

test('plan summary and monte carlo run over seed plan', () => {
  const plan = ops.listPlans({ clientId: 'CUST-001' })[0];
  const summary = ops.getPlanSummary(plan.planId);
  assert.equal(summary.planId, plan.planId);
  assert.ok(summary.goalCount > 0);

  const mc = ops.runPlanMonteCarlo(plan.planId, { iterations: 200, seed: 42 });
  assert.equal(mc.planId, plan.planId);
  assert.ok(mc.blendedProbabilityOfSuccess >= 0 && mc.blendedProbabilityOfSuccess <= 1);
  assert.equal(mc.goals.length, summary.goalCount);
});

test('net worth + asset CRUD lifecycle', () => {
  const before = ops.getNetWorth('CUST-001');
  const item = ops.addAsset('CUST-001', { kind: 'ASSET', category: 'CASH', description: 'New savings', value: 50000 });
  assert.ok(item.itemId.startsWith('ASSET-'));
  const after = ops.getNetWorth('CUST-001');
  assert.equal(after.totalAssets, before.totalAssets + 50000);

  ops.updateAsset(item.itemId, { value: 60000 });
  assert.equal(ops.getNetWorth('CUST-001').totalAssets, before.totalAssets + 60000);

  ops.deleteAsset(item.itemId);
  assert.equal(ops.getNetWorth('CUST-001').totalAssets, before.totalAssets);
});

test('addAsset rejects a liability category on an asset', () => {
  assert.throws(
    () => ops.addAsset('CUST-001', { kind: 'ASSET', category: 'MORTGAGE', value: 1000 }),
    (e) => e instanceof ApiError && e.status === 400,
  );
});

test('runGoalProjection matches direct projection shape', () => {
  const goal = ops.listGoals({ clientId: 'CUST-001' })[0];
  const p = ops.runGoalProjection(goal.goalId);
  assert.equal(p.goalId, goal.goalId);
  assert.ok('fundedPercentage' in p);
  assert.ok('requiredMonthlyContribution' in p);
});
