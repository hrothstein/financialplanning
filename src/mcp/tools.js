/**
 * MCP tool registry for the Financial Planning System (PRD §6).
 *
 * Each tool wraps the SAME operations-layer function the REST routes use, so
 * there is one implementation of every business operation. Tool naming follows
 * the `planning_{operation}_{entity}` convention.
 *
 * Each entry: { name, description, inputSchema (JSON Schema), handler }.
 * The handler receives the parsed `arguments` object and returns a plain JS
 * value, which the server serializes as JSON text content.
 */

import * as ops from '../lib/operations.js';

const S = (props = {}, required = []) => ({
  type: 'object',
  properties: props,
  required,
  additionalProperties: true,
});

const str = (description, example) => ({ type: 'string', ...(description ? { description } : {}), ...(example ? { examples: [example] } : {}) });
const num = (description) => ({ type: 'number', ...(description ? { description } : {}) });
const int = (description) => ({ type: 'integer', ...(description ? { description } : {}) });
const bool = (description) => ({ type: 'boolean', ...(description ? { description } : {}) });

const GOAL_TYPES = ['RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'MAJOR_PURCHASE', 'EMERGENCY_FUND', 'WEALTH_ACCUMULATION', 'LEGACY'];

export const tools = [
  // --- Clients ---
  {
    name: 'planning_list_clients',
    description: 'List financial-planning clients. Optionally filter by risk tolerance. Client IDs align with the PortfolioManagement demo (CUST-001…).',
    inputSchema: S({
      riskTolerance: { type: 'string', enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'], description: 'Optional filter' },
    }),
    handler: (a) => ops.listClients({ riskTolerance: a.riskTolerance }),
  },
  {
    name: 'planning_get_client',
    description: 'Get a single client by ID (e.g. CUST-001).',
    inputSchema: S({ clientId: str('Client ID', 'CUST-001') }, ['clientId']),
    handler: (a) => ops.getClient(a.clientId),
  },
  {
    name: 'planning_get_client_summary',
    description: 'Client summary: goal count, net worth, and the share of goals on track.',
    inputSchema: S({ clientId: str('Client ID', 'CUST-001') }, ['clientId']),
    handler: (a) => ops.getClientSummary(a.clientId),
  },

  // --- Goals ---
  {
    name: 'planning_list_goals',
    description: 'List financial goals. Filter by clientId, type, computed status, or priority.',
    inputSchema: S({
      clientId: str('Filter by client'),
      type: { type: 'string', enum: GOAL_TYPES },
      status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] },
      priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
    }),
    handler: (a) => ops.listGoals({ clientId: a.clientId, type: a.type, status: a.status, priority: a.priority }),
  },
  {
    name: 'planning_create_goal',
    description: 'Create a financial goal for a client. expectedReturnRate defaults from the client risk tolerance if omitted; status is computed.',
    inputSchema: S({
      clientId: str('Owning client', 'CUST-001'),
      type: { type: 'string', enum: GOAL_TYPES },
      name: str('Human-readable goal name', 'Retirement'),
      targetAmount: num('Goal cost (today or future dollars — see inTodaysDollars)'),
      inTodaysDollars: bool('If true, the engine inflates targetAmount to the target year'),
      targetDate: str('ISO date when money is needed', '2051-01-01'),
      currentSavings: num('Amount earmarked today'),
      monthlyContribution: num('Ongoing monthly contribution'),
      priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      expectedReturnRate: num('Annual return decimal; defaults from risk tolerance'),
    }, ['clientId', 'type', 'name', 'targetAmount', 'targetDate']),
    handler: (a) => ops.createGoal(a),
  },
  {
    name: 'planning_get_goal',
    description: 'Get a single goal by ID (includes computed status).',
    inputSchema: S({ goalId: str('Goal ID', 'GOAL-00001') }, ['goalId']),
    handler: (a) => ops.getGoal(a.goalId),
  },
  {
    name: 'planning_update_goal',
    description: 'Update fields on a goal. Any omitted field is left unchanged; status is recomputed.',
    inputSchema: S({
      goalId: str('Goal ID', 'GOAL-00001'),
      type: { type: 'string', enum: GOAL_TYPES },
      name: str(),
      targetAmount: num(),
      inTodaysDollars: bool(),
      targetDate: str('ISO date'),
      currentSavings: num(),
      monthlyContribution: num(),
      priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] },
      expectedReturnRate: num(),
    }, ['goalId']),
    handler: (a) => {
      const { goalId, ...rest } = a;
      return ops.updateGoal(goalId, rest);
    },
  },
  {
    name: 'planning_delete_goal',
    description: 'Delete a goal by ID (also removes it from any plan that references it).',
    inputSchema: S({ goalId: str('Goal ID', 'GOAL-00001') }, ['goalId']),
    handler: (a) => ops.deleteGoal(a.goalId),
  },

  // --- Projection / Monte Carlo (goal) ---
  {
    name: 'planning_run_projection',
    description: 'Run the deterministic projection for a goal: projected amount, funded %, status, and required monthly contribution to fully fund it.',
    inputSchema: S({
      goalId: str('Goal ID', 'GOAL-00001'),
      asOf: str('Optional valuation date (ISO); defaults to today'),
    }, ['goalId']),
    handler: (a) => ops.runGoalProjection(a.goalId, { asOf: a.asOf }),
  },
  {
    name: 'planning_run_monte_carlo',
    description: 'Run a Monte Carlo simulation for a goal: probability of success and p10/p25/p50/p75/p90 ending balances. Seeded for reproducible demo numbers.',
    inputSchema: S({
      goalId: str('Goal ID', 'GOAL-00001'),
      iterations: int('Iteration count (default 1000, max 10000)'),
      seed: int('RNG seed (default 42)'),
      asOf: str('Optional valuation date (ISO)'),
    }, ['goalId']),
    handler: (a) => ops.runGoalMonteCarlo(a.goalId, { iterations: a.iterations, seed: a.seed, asOf: a.asOf }),
  },

  // --- Plans ---
  {
    name: 'planning_list_plans',
    description: 'List financial plans. Filter by clientId or status (DRAFT|ACTIVE|ARCHIVED).',
    inputSchema: S({
      clientId: str('Filter by client'),
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
    }),
    handler: (a) => ops.listPlans({ clientId: a.clientId, status: a.status }),
  },
  {
    name: 'planning_create_plan',
    description: 'Create a plan grouping a client\'s goals plus assumptions.',
    inputSchema: S({
      clientId: str('Owning client', 'CUST-001'),
      name: str('Plan name', '2026 Financial Plan'),
      goalIds: { type: 'array', items: { type: 'string' }, description: 'Goal IDs to include (must belong to the client)' },
      assumptions: {
        type: 'object',
        properties: {
          inflationRate: num(), defaultReturnRate: num(),
          socialSecurityMonthly: num(), lifeExpectancy: int(),
        },
      },
      status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] },
    }, ['clientId', 'name']),
    handler: (a) => ops.createPlan(a),
  },
  {
    name: 'planning_get_plan',
    description: 'Get a single plan by ID.',
    inputSchema: S({ planId: str('Plan ID', 'PLAN-00001') }, ['planId']),
    handler: (a) => ops.getPlan(a.planId),
  },
  {
    name: 'planning_get_plan_summary',
    description: 'Aggregate summary across all goals in a plan: counts by status, total target vs projected, overall funded %, and goals needing attention with their contribution gap.',
    inputSchema: S({
      planId: str('Plan ID', 'PLAN-00001'),
      asOf: str('Optional valuation date (ISO)'),
    }, ['planId']),
    handler: (a) => ops.getPlanSummary(a.planId, { asOf: a.asOf }),
  },
  {
    name: 'planning_run_plan_monte_carlo',
    description: 'Run Monte Carlo across every goal in a plan: per-goal probability of success plus a blended plan-level probability.',
    inputSchema: S({
      planId: str('Plan ID', 'PLAN-00001'),
      iterations: int('Iteration count (default 1000, max 10000)'),
      seed: int('RNG seed (default 42)'),
    }, ['planId']),
    handler: (a) => ops.runPlanMonteCarlo(a.planId, { iterations: a.iterations, seed: a.seed }),
  },

  // --- Net worth / assets ---
  {
    name: 'planning_get_net_worth',
    description: 'Compute a client\'s net worth with asset and liability breakdowns by category.',
    inputSchema: S({ clientId: str('Client ID', 'CUST-001') }, ['clientId']),
    handler: (a) => ops.getNetWorth(a.clientId),
  },
  {
    name: 'planning_list_assets',
    description: 'List a client\'s assets and liabilities.',
    inputSchema: S({ clientId: str('Client ID', 'CUST-001') }, ['clientId']),
    handler: (a) => ops.listAssets(a.clientId),
  },
  {
    name: 'planning_add_asset',
    description: 'Add an asset or liability for a client.',
    inputSchema: S({
      clientId: str('Client ID', 'CUST-001'),
      kind: { type: 'string', enum: ['ASSET', 'LIABILITY'] },
      category: str('Asset: INVESTMENT|CASH|REAL_ESTATE|RETIREMENT_ACCOUNT|OTHER. Liability: MORTGAGE|STUDENT_LOAN|CREDIT_CARD|AUTO_LOAN|OTHER'),
      description: str('Free-text description'),
      value: num('Positive amount; a liability value is the balance owed'),
      linkedAccountId: str('Optional PortfolioManagement account id'),
    }, ['clientId', 'kind', 'category', 'value']),
    handler: (a) => {
      const { clientId, ...rest } = a;
      return ops.addAsset(clientId, rest);
    },
  },
];

/** Map of tool name -> tool definition, for O(1) dispatch. */
export const toolsByName = new Map(tools.map((t) => [t.name, t]));
