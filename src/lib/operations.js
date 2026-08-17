/**
 * Domain operations layer.
 *
 * This is the single source of truth for every business operation. Both the
 * REST routes (src/routes/) and the MCP tools (src/mcp/) call these functions,
 * so business logic is never duplicated (PRD §6). Functions here work with
 * plain objects and throw ApiError on validation/lookup failures; the caller
 * (route or MCP wrapper) decides how to render the result or error.
 */

import { store, nextGoalId, nextPlanId, nextItemId } from '../data/store.js';
import { returnRateFor } from '../config.js';
import { projectGoal } from '../services/projectionEngine.js';
import { runMonteCarlo } from '../services/monteCarloEngine.js';
import { computeNetWorth } from '../services/netWorthService.js';
import { summarizePlan } from '../services/planSummaryService.js';
import { buildPortfolioOverview } from '../services/portfolioService.js';
import {
  notFound,
  badRequest,
  assertEnum,
  assertNumber,
  assertString,
  assertDate,
} from './errors.js';

const GOAL_TYPES = [
  'RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'MAJOR_PURCHASE',
  'EMERGENCY_FUND', 'WEALTH_ACCUMULATION', 'LEGACY',
];
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];
const PLAN_STATUSES = ['DRAFT', 'ACTIVE', 'ARCHIVED'];
const ASSET_CATEGORIES = ['INVESTMENT', 'CASH', 'REAL_ESTATE', 'RETIREMENT_ACCOUNT', 'OTHER'];
const LIABILITY_CATEGORIES = ['MORTGAGE', 'STUDENT_LOAN', 'CREDIT_CARD', 'AUTO_LOAN', 'OTHER'];

/** Current ISO datetime. Kept in one place so all timestamps are consistent. */
const nowIso = () => new Date().toISOString();

// --- lookups -------------------------------------------------------------

export function getClientOrThrow(clientId) {
  const client = store.clients.get(clientId);
  if (!client) throw notFound(`Client ${clientId} not found`, { clientId });
  return client;
}

export function getGoalOrThrow(goalId) {
  const goal = store.goals.get(goalId);
  if (!goal) throw notFound(`Goal ${goalId} not found`, { goalId });
  return goal;
}

export function getPlanOrThrow(planId) {
  const plan = store.plans.get(planId);
  if (!plan) throw notFound(`Plan ${planId} not found`, { planId });
  return plan;
}

export function getItemOrThrow(itemId) {
  const item = store.items.get(itemId);
  if (!item) throw notFound(`Item ${itemId} not found`, { itemId });
  return item;
}

// --- clients -------------------------------------------------------------

export function listClients({ riskTolerance } = {}) {
  let clients = [...store.clients.values()];
  if (riskTolerance) {
    assertEnum('riskTolerance', riskTolerance, ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE']);
    clients = clients.filter((c) => c.riskTolerance === riskTolerance);
  }
  return clients.sort((a, b) => a.clientId.localeCompare(b.clientId));
}

export function getClient(clientId) {
  return getClientOrThrow(clientId);
}

/** Client header info + goal count + net worth + overall on-track %. */
export function getClientSummary(clientId) {
  const client = getClientOrThrow(clientId);
  const goals = [...store.goals.values()].filter((g) => g.clientId === clientId);
  const items = [...store.items.values()].filter((i) => i.clientId === clientId);

  let onTrack = 0;
  for (const goal of goals) {
    if (projectGoal(goal, client).status === 'ON_TRACK') onTrack += 1;
  }
  const netWorth = computeNetWorth(clientId, items);

  return {
    client,
    goalCount: goals.length,
    onTrackCount: onTrack,
    onTrackPercentage: goals.length > 0 ? Math.round((onTrack / goals.length) * 100) / 100 : 0,
    netWorth: netWorth.netWorth,
    totalAssets: netWorth.totalAssets,
    totalLiabilities: netWorth.totalLiabilities,
  };
}

// --- portfolio (book-wide) -----------------------------------------------

/** Aggregate the whole book of business into an advisor overview. */
export function getPortfolioOverview() {
  return buildPortfolioOverview({
    clients: [...store.clients.values()],
    goals: [...store.goals.values()],
    items: [...store.items.values()],
    plans: [...store.plans.values()],
    project: (goal, client) => projectGoal(goal, client),
  });
}

// --- goals ---------------------------------------------------------------

/** Attach the computed projection status to a goal for list/detail responses. */
function withStatus(goal) {
  const client = store.clients.get(goal.clientId);
  return { ...goal, status: projectGoal(goal, client).status };
}

export function listGoals(filters = {}) {
  const { clientId, type, status, priority } = filters;
  if (type) assertEnum('type', type, GOAL_TYPES);
  if (status) assertEnum('status', status, ['ON_TRACK', 'AT_RISK', 'OFF_TRACK']);
  if (priority) assertEnum('priority', priority, PRIORITIES);

  let goals = [...store.goals.values()].map(withStatus);
  if (clientId) goals = goals.filter((g) => g.clientId === clientId);
  if (type) goals = goals.filter((g) => g.type === type);
  if (priority) goals = goals.filter((g) => g.priority === priority);
  if (status) goals = goals.filter((g) => g.status === status);
  return goals.sort((a, b) => a.goalId.localeCompare(b.goalId));
}

export function getGoal(goalId) {
  return withStatus(getGoalOrThrow(goalId));
}

export function createGoal(body = {}) {
  const clientId = assertString('clientId', body.clientId);
  const client = getClientOrThrow(clientId);
  assertEnum('type', body.type, GOAL_TYPES);
  assertString('name', body.name);
  assertNumber('targetAmount', body.targetAmount, { min: 0 });
  assertDate('targetDate', body.targetDate);

  const priority = body.priority ?? 'MEDIUM';
  assertEnum('priority', priority, PRIORITIES);

  const currentSavings = body.currentSavings ?? 0;
  assertNumber('currentSavings', currentSavings, { min: 0 });
  const monthlyContribution = body.monthlyContribution ?? 0;
  assertNumber('monthlyContribution', monthlyContribution, { min: 0 });

  // Default expected return from the client's risk tolerance when omitted.
  const expectedReturnRate =
    body.expectedReturnRate != null
      ? assertNumber('expectedReturnRate', body.expectedReturnRate, { min: 0 })
      : returnRateFor(client.riskTolerance);

  const ts = nowIso();
  const goal = {
    goalId: nextGoalId(),
    clientId,
    type: body.type,
    name: body.name,
    targetAmount: body.targetAmount,
    inTodaysDollars: body.inTodaysDollars ?? false,
    targetDate: body.targetDate.slice(0, 10),
    currentSavings,
    monthlyContribution,
    priority,
    expectedReturnRate,
    createdAt: ts,
    updatedAt: ts,
  };
  store.goals.set(goal.goalId, goal);
  return withStatus(goal);
}

const GOAL_MUTABLE_FIELDS = [
  'type', 'name', 'targetAmount', 'inTodaysDollars', 'targetDate',
  'currentSavings', 'monthlyContribution', 'priority', 'expectedReturnRate',
];

export function updateGoal(goalId, body = {}) {
  const goal = getGoalOrThrow(goalId);
  const updated = { ...goal };

  if (body.type !== undefined) updated.type = assertEnum('type', body.type, GOAL_TYPES);
  if (body.name !== undefined) updated.name = assertString('name', body.name);
  if (body.targetAmount !== undefined) updated.targetAmount = assertNumber('targetAmount', body.targetAmount, { min: 0 });
  if (body.inTodaysDollars !== undefined) updated.inTodaysDollars = Boolean(body.inTodaysDollars);
  if (body.targetDate !== undefined) updated.targetDate = assertDate('targetDate', body.targetDate).slice(0, 10);
  if (body.currentSavings !== undefined) updated.currentSavings = assertNumber('currentSavings', body.currentSavings, { min: 0 });
  if (body.monthlyContribution !== undefined) updated.monthlyContribution = assertNumber('monthlyContribution', body.monthlyContribution, { min: 0 });
  if (body.priority !== undefined) updated.priority = assertEnum('priority', body.priority, PRIORITIES);
  if (body.expectedReturnRate !== undefined) updated.expectedReturnRate = assertNumber('expectedReturnRate', body.expectedReturnRate, { min: 0 });

  updated.updatedAt = nowIso();
  store.goals.set(goalId, updated);
  return withStatus(updated);
}

export function deleteGoal(goalId) {
  getGoalOrThrow(goalId);
  store.goals.delete(goalId);
  // Also drop the goal from any plan that references it.
  for (const plan of store.plans.values()) {
    if (plan.goalIds.includes(goalId)) {
      plan.goalIds = plan.goalIds.filter((id) => id !== goalId);
      plan.updatedAt = nowIso();
    }
  }
  return { deleted: true, goalId };
}

// --- projections / monte carlo (goal) ------------------------------------

export function runGoalProjection(goalId, { asOf } = {}) {
  const goal = getGoalOrThrow(goalId);
  const client = store.clients.get(goal.clientId);
  const opts = {};
  if (asOf) {
    assertDate('asOf', asOf);
    opts.asOf = new Date(asOf);
  }
  return projectGoal(goal, client, opts);
}

export function runGoalMonteCarlo(goalId, { iterations, seed, asOf } = {}) {
  const goal = getGoalOrThrow(goalId);
  const client = store.clients.get(goal.clientId);
  const opts = {};
  if (iterations != null) opts.iterations = assertNumber('iterations', Number(iterations), { min: 1 });
  if (seed != null) opts.seed = assertNumber('seed', Number(seed));
  if (asOf) {
    assertDate('asOf', asOf);
    opts.asOf = new Date(asOf);
  }
  return runMonteCarlo(goal, client, opts);
}

// --- plans ---------------------------------------------------------------

export function listPlans(filters = {}) {
  const { clientId, status } = filters;
  if (status) assertEnum('status', status, PLAN_STATUSES);
  let plans = [...store.plans.values()];
  if (clientId) plans = plans.filter((p) => p.clientId === clientId);
  if (status) plans = plans.filter((p) => p.status === status);
  return plans.sort((a, b) => a.planId.localeCompare(b.planId));
}

export function getPlan(planId) {
  return getPlanOrThrow(planId);
}

export function createPlan(body = {}) {
  const clientId = assertString('clientId', body.clientId);
  getClientOrThrow(clientId);
  assertString('name', body.name);

  const goalIds = body.goalIds ?? [];
  if (!Array.isArray(goalIds)) throw badRequest('goalIds must be an array', { field: 'goalIds' });
  // Every referenced goal must exist and belong to this client.
  for (const gid of goalIds) {
    const goal = getGoalOrThrow(gid);
    if (goal.clientId !== clientId) {
      throw badRequest(`Goal ${gid} does not belong to client ${clientId}`, { goalId: gid, clientId });
    }
  }

  const status = body.status ?? 'DRAFT';
  assertEnum('status', status, PLAN_STATUSES);

  const ts = nowIso();
  const plan = {
    planId: nextPlanId(),
    clientId,
    name: body.name,
    goalIds,
    assumptions: {
      inflationRate: body.assumptions?.inflationRate ?? 0.025,
      defaultReturnRate: body.assumptions?.defaultReturnRate ?? returnRateFor(store.clients.get(clientId).riskTolerance),
      socialSecurityMonthly: body.assumptions?.socialSecurityMonthly ?? 0,
      lifeExpectancy: body.assumptions?.lifeExpectancy ?? 90,
    },
    status,
    createdAt: ts,
    updatedAt: ts,
  };
  store.plans.set(plan.planId, plan);
  return plan;
}

export function updatePlan(planId, body = {}) {
  const plan = getPlanOrThrow(planId);
  const updated = { ...plan, assumptions: { ...plan.assumptions } };

  if (body.name !== undefined) updated.name = assertString('name', body.name);
  if (body.status !== undefined) updated.status = assertEnum('status', body.status, PLAN_STATUSES);
  if (body.goalIds !== undefined) {
    if (!Array.isArray(body.goalIds)) throw badRequest('goalIds must be an array', { field: 'goalIds' });
    for (const gid of body.goalIds) {
      const goal = getGoalOrThrow(gid);
      if (goal.clientId !== plan.clientId) {
        throw badRequest(`Goal ${gid} does not belong to client ${plan.clientId}`, { goalId: gid });
      }
    }
    updated.goalIds = body.goalIds;
  }
  if (body.assumptions !== undefined && typeof body.assumptions === 'object') {
    updated.assumptions = { ...updated.assumptions, ...body.assumptions };
  }

  updated.updatedAt = nowIso();
  store.plans.set(planId, updated);
  return updated;
}

export function deletePlan(planId) {
  getPlanOrThrow(planId);
  store.plans.delete(planId);
  return { deleted: true, planId };
}

export function getPlanSummary(planId, { asOf } = {}) {
  const plan = getPlanOrThrow(planId);
  const goals = plan.goalIds.map((id) => store.goals.get(id)).filter(Boolean);
  const opts = {};
  if (asOf) {
    assertDate('asOf', asOf);
    opts.asOf = new Date(asOf);
  }
  return summarizePlan(plan, goals, (cid) => store.clients.get(cid), opts);
}

/** Monte Carlo across all goals in a plan: per-goal + blended probability. */
export function runPlanMonteCarlo(planId, { iterations, seed, asOf } = {}) {
  const plan = getPlanOrThrow(planId);
  const goals = plan.goalIds.map((id) => store.goals.get(id)).filter(Boolean);

  const opts = {};
  if (iterations != null) opts.iterations = assertNumber('iterations', Number(iterations), { min: 1 });
  if (seed != null) opts.seed = assertNumber('seed', Number(seed));
  if (asOf) {
    assertDate('asOf', asOf);
    opts.asOf = new Date(asOf);
  }

  const perGoal = goals.map((goal) => {
    const client = store.clients.get(goal.clientId);
    const mc = runMonteCarlo(goal, client, opts);
    return { goalId: goal.goalId, name: goal.name, type: goal.type, ...mc };
  });

  // Blended probability = mean of per-goal success probabilities (a simple,
  // explainable demo blend — not a joint simulation).
  const blended =
    perGoal.length > 0
      ? Math.round((perGoal.reduce((s, g) => s + g.probabilityOfSuccess, 0) / perGoal.length) * 100) / 100
      : 0;

  return {
    planId,
    clientId: plan.clientId,
    goalCount: perGoal.length,
    iterations: perGoal[0]?.iterations ?? (opts.iterations ?? 1000),
    seed: perGoal[0]?.seed ?? (opts.seed ?? 42),
    blendedProbabilityOfSuccess: blended,
    goals: perGoal,
  };
}

// --- net worth / assets --------------------------------------------------

export function getNetWorth(clientId) {
  getClientOrThrow(clientId);
  const items = [...store.items.values()].filter((i) => i.clientId === clientId);
  return computeNetWorth(clientId, items);
}

export function listAssets(clientId) {
  getClientOrThrow(clientId);
  const items = [...store.items.values()]
    .filter((i) => i.clientId === clientId)
    .sort((a, b) => a.itemId.localeCompare(b.itemId));
  return items;
}

export function addAsset(clientId, body = {}) {
  getClientOrThrow(clientId);
  const kind = body.kind ?? 'ASSET';
  assertEnum('kind', kind, ['ASSET', 'LIABILITY']);
  const allowedCategories = kind === 'ASSET' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
  assertEnum('category', body.category, allowedCategories);
  assertNumber('value', body.value, { min: 0 });

  const item = {
    itemId: nextItemId(kind),
    clientId,
    kind,
    category: body.category,
    description: body.description ?? '',
    value: body.value,
    ...(body.linkedAccountId ? { linkedAccountId: body.linkedAccountId } : {}),
  };
  store.items.set(item.itemId, item);
  return item;
}

export function updateAsset(itemId, body = {}) {
  const item = getItemOrThrow(itemId);
  const updated = { ...item };

  if (body.kind !== undefined) updated.kind = assertEnum('kind', body.kind, ['ASSET', 'LIABILITY']);
  if (body.category !== undefined) {
    const allowed = updated.kind === 'ASSET' ? ASSET_CATEGORIES : LIABILITY_CATEGORIES;
    updated.category = assertEnum('category', body.category, allowed);
  }
  if (body.description !== undefined) updated.description = String(body.description);
  if (body.value !== undefined) updated.value = assertNumber('value', body.value, { min: 0 });
  if (body.linkedAccountId !== undefined) {
    if (body.linkedAccountId === null) delete updated.linkedAccountId;
    else updated.linkedAccountId = String(body.linkedAccountId);
  }

  store.items.set(itemId, updated);
  return updated;
}

export function deleteAsset(itemId) {
  getItemOrThrow(itemId);
  store.items.delete(itemId);
  return { deleted: true, itemId };
}
