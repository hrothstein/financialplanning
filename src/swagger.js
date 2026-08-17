/**
 * OpenAPI 3.0 definition + swagger-ui wiring, served at /docs.
 *
 * The spec is hand-authored (rather than generated from JSDoc) so the demo has
 * a polished, complete API reference even if the optional frontend is skipped
 * (PRD §8). Every REST endpoint in PRD §5 is documented here.
 */

import swaggerUi from 'swagger-ui-express';

const GOAL_TYPES = [
  'RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'MAJOR_PURCHASE',
  'EMERGENCY_FUND', 'WEALTH_ACCUMULATION', 'LEGACY',
];

const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Financial Planning System API',
    version: '1.0.0',
    description:
      'Goals-based financial planning demo backend. Create client financial goals, ' +
      'project whether they are on track, run Monte Carlo simulations, aggregate net worth, ' +
      'and produce advisor-ready plan summaries. Part of a Salesforce Financial Services Cloud ' +
      '+ MuleSoft demo estate. Demo-grade: in-memory store, no auth, resets on restart.',
    license: { name: 'MIT' },
    contact: { name: 'Howie Rothstein' },
  },
  servers: [
    { url: '/api/v1', description: 'API base path' },
  ],
  tags: [
    { name: 'Clients', description: 'Read-only client projection + summaries' },
    { name: 'Goals', description: 'Financial goals: CRUD, projection, Monte Carlo' },
    { name: 'Plans', description: 'Plans grouping goals: CRUD, summary, Monte Carlo' },
    { name: 'Net Worth', description: 'Assets, liabilities, and net worth' },
    { name: 'Utility', description: 'Health check and demo reset' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Utility'],
        summary: 'Health check',
        responses: {
          200: {
            description: 'Service is healthy',
            content: {
              'application/json': {
                example: { status: 'ok', service: 'financial-planning', timestamp: '2026-01-01T00:00:00.000Z' },
              },
            },
          },
        },
      },
    },
    '/demo/reset': {
      post: {
        tags: ['Utility'],
        summary: 'Reset demo data to the original seed set',
        responses: {
          200: {
            description: 'Seed data restored',
            content: {
              'application/json': {
                example: {
                  status: 'ok',
                  message: 'Seed data restored',
                  counts: { clients: 50, goals: 132, plans: 40, items: 220 },
                  timestamp: '2026-01-01T00:00:00.000Z',
                },
              },
            },
          },
        },
      },
    },
    '/clients': {
      get: {
        tags: ['Clients'],
        summary: 'List clients',
        parameters: [
          { $ref: '#/components/parameters/RiskToleranceFilter' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Offset' },
        ],
        responses: { 200: { description: 'Paginated client list' } },
      },
    },
    '/clients/{clientId}': {
      get: {
        tags: ['Clients'],
        summary: 'Get a client',
        parameters: [{ $ref: '#/components/parameters/ClientId' }],
        responses: {
          200: { description: 'Client', content: { 'application/json': { schema: { $ref: '#/components/schemas/Client' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/clients/{clientId}/summary': {
      get: {
        tags: ['Clients'],
        summary: 'Client summary: goal count, net worth, overall on-track %',
        parameters: [{ $ref: '#/components/parameters/ClientId' }],
        responses: {
          200: { description: 'Client summary' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/clients/{clientId}/net-worth': {
      get: {
        tags: ['Net Worth'],
        summary: 'Compute net worth with category breakdown',
        parameters: [{ $ref: '#/components/parameters/ClientId' }],
        responses: {
          200: { description: 'Net worth', content: { 'application/json': { schema: { $ref: '#/components/schemas/NetWorth' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/clients/{clientId}/assets': {
      get: {
        tags: ['Net Worth'],
        summary: 'List a client\'s assets & liabilities',
        parameters: [
          { $ref: '#/components/parameters/ClientId' },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Offset' },
        ],
        responses: { 200: { description: 'Paginated items' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
      post: {
        tags: ['Net Worth'],
        summary: 'Add an asset or liability',
        parameters: [{ $ref: '#/components/parameters/ClientId' }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AssetInput' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Asset' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/assets/{itemId}': {
      put: {
        tags: ['Net Worth'],
        summary: 'Update an asset or liability',
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' }, example: 'ASSET-00001' }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/AssetInput' } } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Asset' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Net Worth'],
        summary: 'Delete an asset or liability',
        parameters: [{ name: 'itemId', in: 'path', required: true, schema: { type: 'string' }, example: 'ASSET-00001' }],
        responses: { 200: { description: 'Deleted' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/goals': {
      get: {
        tags: ['Goals'],
        summary: 'List goals',
        parameters: [
          { name: 'clientId', in: 'query', schema: { type: 'string' }, example: 'CUST-001' },
          { name: 'type', in: 'query', schema: { type: 'string', enum: GOAL_TYPES } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] } },
          { name: 'priority', in: 'query', schema: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'] } },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Offset' },
        ],
        responses: { 200: { description: 'Paginated goal list' } },
      },
      post: {
        tags: ['Goals'],
        summary: 'Create a goal',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/GoalInput' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Goal' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/goals/{goalId}': {
      get: {
        tags: ['Goals'],
        summary: 'Get a goal',
        parameters: [{ $ref: '#/components/parameters/GoalId' }],
        responses: {
          200: { description: 'Goal', content: { 'application/json': { schema: { $ref: '#/components/schemas/Goal' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Goals'],
        summary: 'Update a goal (recomputes status)',
        parameters: [{ $ref: '#/components/parameters/GoalId' }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/GoalInput' } } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Goal' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Goals'],
        summary: 'Delete a goal',
        parameters: [{ $ref: '#/components/parameters/GoalId' }],
        responses: { 200: { description: 'Deleted' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/goals/{goalId}/projection': {
      get: {
        tags: ['Goals'],
        summary: 'Deterministic projection for a goal',
        parameters: [
          { $ref: '#/components/parameters/GoalId' },
          { name: 'asOf', in: 'query', schema: { type: 'string', format: 'date' }, description: 'Valuation date (default: today)' },
        ],
        responses: {
          200: {
            description: 'Projection',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Projection' },
                example: {
                  goalId: 'GOAL-00001', clientId: 'CUST-001', type: 'RETIREMENT', yearsToTarget: 25,
                  assumptions: { expectedReturnRate: 0.065, inflationRate: 0.025 },
                  targetAmount: 2000000, adjustedTargetAmount: 2378000, projectedAmount: 2110450,
                  fundedPercentage: 0.887, status: 'AT_RISK', currentMonthlyContribution: 1500,
                  requiredMonthlyContribution: 1815, monthlyShortfall: 315,
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/goals/{goalId}/monte-carlo': {
      get: {
        tags: ['Goals'],
        summary: 'Monte Carlo simulation for a goal',
        parameters: [
          { $ref: '#/components/parameters/GoalId' },
          { name: 'iterations', in: 'query', schema: { type: 'integer', default: 1000, maximum: 10000 } },
          { name: 'seed', in: 'query', schema: { type: 'integer', default: 42 }, description: 'RNG seed for reproducible demo numbers' },
          { name: 'asOf', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          200: {
            description: 'Monte Carlo result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MonteCarlo' },
                example: {
                  goalId: 'GOAL-00001', iterations: 1000, seed: 42, probabilityOfSuccess: 0.72,
                  targetAmount: 2378000, percentiles: { p10: 1650000, p25: 1920000, p50: 2280000, p75: 2710000, p90: 3180000 },
                },
              },
            },
          },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/plans': {
      get: {
        tags: ['Plans'],
        summary: 'List plans',
        parameters: [
          { name: 'clientId', in: 'query', schema: { type: 'string' }, example: 'CUST-001' },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'] } },
          { $ref: '#/components/parameters/Limit' },
          { $ref: '#/components/parameters/Offset' },
        ],
        responses: { 200: { description: 'Paginated plan list' } },
      },
      post: {
        tags: ['Plans'],
        summary: 'Create a plan',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/PlanInput' } } },
        },
        responses: {
          201: { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/Plan' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/plans/{planId}': {
      get: {
        tags: ['Plans'],
        summary: 'Get a plan',
        parameters: [{ $ref: '#/components/parameters/PlanId' }],
        responses: {
          200: { description: 'Plan', content: { 'application/json': { schema: { $ref: '#/components/schemas/Plan' } } } },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Plans'],
        summary: 'Update a plan',
        parameters: [{ $ref: '#/components/parameters/PlanId' }],
        requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/PlanInput' } } } },
        responses: {
          200: { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/Plan' } } } },
          400: { $ref: '#/components/responses/BadRequest' },
          404: { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Plans'],
        summary: 'Delete a plan',
        parameters: [{ $ref: '#/components/parameters/PlanId' }],
        responses: { 200: { description: 'Deleted' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/plans/{planId}/summary': {
      get: {
        tags: ['Plans'],
        summary: 'Aggregate plan summary across all goals',
        parameters: [
          { $ref: '#/components/parameters/PlanId' },
          { name: 'asOf', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: { 200: { description: 'Plan summary' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },
    '/plans/{planId}/monte-carlo': {
      get: {
        tags: ['Plans'],
        summary: 'Monte Carlo across all goals in the plan (per-goal + blended)',
        parameters: [
          { $ref: '#/components/parameters/PlanId' },
          { name: 'iterations', in: 'query', schema: { type: 'integer', default: 1000, maximum: 10000 } },
          { name: 'seed', in: 'query', schema: { type: 'integer', default: 42 } },
        ],
        responses: { 200: { description: 'Plan Monte Carlo result' }, 404: { $ref: '#/components/responses/NotFound' } },
      },
    },
  },
  components: {
    parameters: {
      ClientId: { name: 'clientId', in: 'path', required: true, schema: { type: 'string' }, example: 'CUST-001' },
      GoalId: { name: 'goalId', in: 'path', required: true, schema: { type: 'string' }, example: 'GOAL-00001' },
      PlanId: { name: 'planId', in: 'path', required: true, schema: { type: 'string' }, example: 'PLAN-00001' },
      Limit: { name: 'limit', in: 'query', schema: { type: 'integer', default: 50, maximum: 200 } },
      Offset: { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
      RiskToleranceFilter: { name: 'riskTolerance', in: 'query', schema: { type: 'string', enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] } },
    },
    responses: {
      NotFound: {
        description: 'Resource not found',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: { code: 'NOT_FOUND', message: 'Goal GOAL-99999 not found' } } } },
      },
      BadRequest: {
        description: 'Validation error',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' }, example: { error: { code: 'BAD_REQUEST', message: 'Invalid type', details: { field: 'type' } } } } },
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
      Client: {
        type: 'object',
        properties: {
          clientId: { type: 'string', example: 'CUST-001' },
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          age: { type: 'integer' },
          retirementAge: { type: 'integer', example: 65 },
          annualIncome: { type: 'number' },
          filingStatus: { type: 'string', enum: ['SINGLE', 'MARRIED_JOINT', 'MARRIED_SEPARATE', 'HEAD_OF_HOUSEHOLD'] },
          riskTolerance: { type: 'string', enum: ['CONSERVATIVE', 'MODERATE', 'AGGRESSIVE'] },
        },
      },
      GoalInput: {
        type: 'object',
        required: ['clientId', 'type', 'name', 'targetAmount', 'targetDate'],
        properties: {
          clientId: { type: 'string', example: 'CUST-001' },
          type: { type: 'string', enum: GOAL_TYPES },
          name: { type: 'string', example: 'Retirement' },
          targetAmount: { type: 'number', example: 2000000 },
          inTodaysDollars: { type: 'boolean', default: false },
          targetDate: { type: 'string', format: 'date', example: '2051-01-01' },
          currentSavings: { type: 'number', default: 0 },
          monthlyContribution: { type: 'number', default: 0 },
          priority: { type: 'string', enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
          expectedReturnRate: { type: 'number', description: 'Defaults from client risk tolerance if omitted', example: 0.065 },
        },
      },
      Goal: {
        allOf: [
          { $ref: '#/components/schemas/GoalInput' },
          {
            type: 'object',
            properties: {
              goalId: { type: 'string', example: 'GOAL-00001' },
              status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      Projection: {
        type: 'object',
        properties: {
          goalId: { type: 'string' },
          clientId: { type: 'string' },
          type: { type: 'string' },
          yearsToTarget: { type: 'number' },
          assumptions: { type: 'object', properties: { expectedReturnRate: { type: 'number' }, inflationRate: { type: 'number' } } },
          targetAmount: { type: 'number' },
          adjustedTargetAmount: { type: 'number' },
          projectedAmount: { type: 'number' },
          fundedPercentage: { type: 'number' },
          status: { type: 'string', enum: ['ON_TRACK', 'AT_RISK', 'OFF_TRACK'] },
          currentMonthlyContribution: { type: 'number' },
          requiredMonthlyContribution: { type: 'number' },
          monthlyShortfall: { type: 'number' },
        },
      },
      MonteCarlo: {
        type: 'object',
        properties: {
          goalId: { type: 'string' },
          iterations: { type: 'integer' },
          seed: { type: 'integer' },
          probabilityOfSuccess: { type: 'number' },
          targetAmount: { type: 'number' },
          percentiles: {
            type: 'object',
            properties: {
              p10: { type: 'number' }, p25: { type: 'number' }, p50: { type: 'number' },
              p75: { type: 'number' }, p90: { type: 'number' },
            },
          },
        },
      },
      PlanInput: {
        type: 'object',
        required: ['clientId', 'name'],
        properties: {
          clientId: { type: 'string', example: 'CUST-001' },
          name: { type: 'string', example: '2026 Financial Plan' },
          goalIds: { type: 'array', items: { type: 'string' }, example: ['GOAL-00001', 'GOAL-00002'] },
          assumptions: {
            type: 'object',
            properties: {
              inflationRate: { type: 'number', example: 0.025 },
              defaultReturnRate: { type: 'number', example: 0.065 },
              socialSecurityMonthly: { type: 'number', example: 2500 },
              lifeExpectancy: { type: 'integer', example: 90 },
            },
          },
          status: { type: 'string', enum: ['DRAFT', 'ACTIVE', 'ARCHIVED'], default: 'DRAFT' },
        },
      },
      Plan: {
        allOf: [
          { $ref: '#/components/schemas/PlanInput' },
          {
            type: 'object',
            properties: {
              planId: { type: 'string', example: 'PLAN-00001' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
        ],
      },
      AssetInput: {
        type: 'object',
        required: ['kind', 'category', 'value'],
        properties: {
          kind: { type: 'string', enum: ['ASSET', 'LIABILITY'] },
          category: { type: 'string', description: 'Asset: INVESTMENT|CASH|REAL_ESTATE|RETIREMENT_ACCOUNT|OTHER; Liability: MORTGAGE|STUDENT_LOAN|CREDIT_CARD|AUTO_LOAN|OTHER' },
          description: { type: 'string' },
          value: { type: 'number', description: 'Positive; a liability value is the balance owed' },
          linkedAccountId: { type: 'string', description: 'Optional PortfolioManagement account id' },
        },
      },
      Asset: {
        allOf: [
          { $ref: '#/components/schemas/AssetInput' },
          { type: 'object', properties: { itemId: { type: 'string', example: 'ASSET-00001' }, clientId: { type: 'string' } } },
        ],
      },
      NetWorth: {
        type: 'object',
        properties: {
          clientId: { type: 'string' },
          totalAssets: { type: 'number' },
          totalLiabilities: { type: 'number' },
          netWorth: { type: 'number' },
          assetBreakdown: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, total: { type: 'number' }, count: { type: 'integer' } } } },
          liabilityBreakdown: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, total: { type: 'number' }, count: { type: 'integer' } } } },
        },
      },
    },
  },
};

/** Mount Swagger UI at /docs and expose the raw spec at /docs.json. */
export function mountSwagger(app) {
  app.get('/docs.json', (_req, res) => res.json(openApiSpec));
  app.use(
    '/docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, {
      customSiteTitle: 'Financial Planning System API',
      swaggerOptions: { docExpansion: 'list', defaultModelsExpandDepth: 1 },
    }),
  );
}

export { openApiSpec };
