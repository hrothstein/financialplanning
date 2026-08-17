# Financial Planning System (FPS)

Goals-based financial planning demo backend for a wealth advisor. Create client
financial goals (retirement, education, home purchase, and more), project
whether they are on track, run Monte Carlo simulations, aggregate net worth, and
produce a plan summary an advisor could review with a client — all exposed as
clean REST APIs **and** an MCP server for AI-agent access.

Part of a Salesforce Financial Services Cloud (FSC) + MuleSoft demo estate. It
fills the middle-office **planning** layer that sits alongside Portfolio
Management (clients, accounts, holdings) and Risk Management (risk scoring, VaR,
suitability).

> **Demo-grade software, not production.** In-memory store (resets on restart),
> no authentication, no database. Built for solutions engineers running live
> demos.

---

## Quick start

Requires **Node.js 18+**.

```bash
npm install
npm start
```

The server boots on **port 3003** (override with `PORT`) and loads seed data
automatically. Then open:

- **API docs (Swagger UI):** http://localhost:3003/docs
- **Health check:** http://localhost:3003/api/v1/health
- **MCP server:** http://localhost:3003/mcp (health at `/mcp/health`)

Run the unit tests (calculation engines + operations layer):

```bash
npm test
```

---

## What's inside

| Concern | Where |
|---|---|
| Express bootstrap (routes, Swagger, MCP) | `src/index.js` |
| REST routes (one file per resource) | `src/routes/` |
| Business logic shared by REST **and** MCP | `src/lib/operations.js` |
| Calculation engines (pure, unit-tested) | `src/services/` |
| In-memory store + reset | `src/data/store.js` |
| Deterministic seed generator | `src/data/seed.js` |
| MCP tool definitions + server | `src/mcp/` |
| OpenAPI 3.0 spec + Swagger UI | `src/swagger.js` |
| Shared assumptions/constants | `src/config.js` |
| Unit tests | `test/` |

The REST routes and MCP tools both call the **same** functions in
`src/lib/operations.js`, so there is exactly one implementation of every
business operation.

---

## REST API

Base URL (dev): `http://localhost:3003/api/v1`. All responses are JSON. List
endpoints support `?limit=` (default 50, max 200) and `?offset=` pagination and
return a `{ total, limit, offset, count, items }` envelope. Validation errors
return `{ "error": { "code", "message", "details" } }` with status `400`;
missing resources return `404`.

### Clients (read-only projection)
| Method | Path | Notes |
|---|---|---|
| `GET` | `/clients` | List. Filter `?riskTolerance=` |
| `GET` | `/clients/:clientId` | Single client |
| `GET` | `/clients/:clientId/summary` | Client + goal count + net worth + on-track % |

### Goals
| Method | Path | Notes |
|---|---|---|
| `GET` | `/goals` | Filters: `?clientId=` `?type=` `?status=` `?priority=` |
| `POST` | `/goals` | Create (defaults `expectedReturnRate` from risk tolerance; computes status) |
| `GET` | `/goals/:goalId` | Single goal (includes computed status) |
| `PUT` | `/goals/:goalId` | Update (recomputes status) |
| `DELETE` | `/goals/:goalId` | Delete (also detached from any plan) |
| `GET` | `/goals/:goalId/projection` | Deterministic projection. `?asOf=` optional |
| `GET` | `/goals/:goalId/monte-carlo` | Monte Carlo. `?iterations=` `?seed=` `?asOf=` |

### Plans
| Method | Path | Notes |
|---|---|---|
| `GET` | `/plans` | Filter `?clientId=` `?status=` |
| `POST` | `/plans` | Create |
| `GET` | `/plans/:planId` | Single plan |
| `PUT` | `/plans/:planId` | Update |
| `DELETE` | `/plans/:planId` | Delete |
| `GET` | `/plans/:planId/summary` | Aggregate summary across all goals |
| `GET` | `/plans/:planId/monte-carlo` | Per-goal + blended probability of success |

### Net Worth
| Method | Path | Notes |
|---|---|---|
| `GET` | `/clients/:clientId/net-worth` | Net worth + category breakdown |
| `GET` | `/clients/:clientId/assets` | List assets & liabilities |
| `POST` | `/clients/:clientId/assets` | Add asset/liability |
| `PUT` | `/assets/:itemId` | Update an item |
| `DELETE` | `/assets/:itemId` | Delete an item |

### Utility
| Method | Path | Notes |
|---|---|---|
| `GET` | `/api/v1/health` | `{ status: "ok", service, timestamp }` |
| `POST` | `/api/v1/demo/reset` | Restore the original seed data |

### Example: `GET /goals/GOAL-00001/projection`

```json
{
  "goalId": "GOAL-00001",
  "clientId": "CUST-001",
  "type": "RETIREMENT",
  "yearsToTarget": 25,
  "assumptions": { "expectedReturnRate": 0.065, "inflationRate": 0.025 },
  "targetAmount": 2000000,
  "adjustedTargetAmount": 3707663.14,
  "projectedAmount": 3336983.14,
  "fundedPercentage": 0.9,
  "status": "AT_RISK",
  "currentMonthlyContribution": 2394,
  "requiredMonthlyContribution": 2889.11,
  "monthlyShortfall": 495.11
}
```

### Example: `GET /goals/GOAL-00001/monte-carlo?seed=42`

```json
{
  "goalId": "GOAL-00001",
  "iterations": 1000,
  "seed": 42,
  "probabilityOfSuccess": 0.28,
  "targetAmount": 3708000,
  "percentiles": { "p10": 1768000, "p25": 2256000, "p50": 2943000, "p75": 3822000, "p90": 5136000 }
}
```

> Note how a goal can be ~90% funded on the deterministic projection yet show a
> lower Monte Carlo probability of success — that's return volatility over a long
> horizon, exactly the tension a planning conversation surfaces.

---

## MCP server

The Model Context Protocol server is mounted at **`/mcp`** over Streamable HTTP
(stateless), so Claude Desktop and other MCP agents can drive the whole system.
Each tool wraps the same service logic as the REST routes. Tool naming follows
`planning_{operation}_{entity}`.

- `GET /mcp/health` — liveness + tool count
- `GET /mcp/tools` — human-readable tool catalog (name, description, input schema)
- `POST /mcp` — JSON-RPC endpoint (initialize / tools/list / tools/call)

**Tools (18):**

| Entity | Tools |
|---|---|
| Clients | `planning_list_clients`, `planning_get_client`, `planning_get_client_summary` |
| Goals | `planning_list_goals`, `planning_create_goal`, `planning_get_goal`, `planning_update_goal`, `planning_delete_goal` |
| Projection / simulation | `planning_run_projection`, `planning_run_monte_carlo` |
| Plans | `planning_list_plans`, `planning_create_plan`, `planning_get_plan`, `planning_get_plan_summary`, `planning_run_plan_monte_carlo` |
| Net worth | `planning_get_net_worth`, `planning_list_assets`, `planning_add_asset` |

Quick check with `curl` (the transport requires an SSE-capable `Accept` header):

```bash
curl -s http://localhost:3003/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call",
       "params":{"name":"planning_run_projection","arguments":{"goalId":"GOAL-00001"}}}'
```

---

## Calculation logic

All math lives in pure, unit-tested functions under `src/services/`.

- **Deterministic projection** (`projectionEngine.js`): future value of current
  savings `FV = PV·(1+r)^n` plus the future value of the monthly contribution
  stream (ordinary annuity). If a target is given in today's dollars it is
  inflated to the target year. `fundedPercentage = projected / adjustedTarget`
  drives the status. It also solves the annuity for the **required monthly
  contribution** needed to fully fund the goal.
- **Monte Carlo** (`monteCarloEngine.js`): 1,000 iterations by default (cap
  10,000), drawing annual returns from `N(expectedReturn, volatility)` via a
  Box–Muller transform over a **seeded** PRNG (Mulberry32), so the same
  `(seed, iterations)` always reproduces the same numbers. Returns probability
  of success and p10/p25/p50/p75/p90 ending balances.
- **Net worth** (`netWorthService.js`): totals and per-category breakdowns.
- **Plan summary** (`planSummaryService.js`): rolls projections up across a
  plan's goals — counts by status, totals, overall funded %, and a prioritized
  list of goals needing attention.

### Assumptions

| Risk tolerance | Expected return | Volatility |
|---|---|---|
| `CONSERVATIVE` | 4.5% | 6% |
| `MODERATE` | 6.5% | 11% |
| `AGGRESSIVE` | 8.5% | 16% |

- Default inflation rate: **2.5%**.
- Goal status thresholds: `ON_TRACK` ≥ 1.0 funded; `AT_RISK` 0.8–1.0;
  `OFF_TRACK` < 0.8.
- A goal's `expectedReturnRate` defaults from its client's risk tolerance when
  not supplied.

---

## Seed data

Generated on boot and restored identically by `POST /api/v1/demo/reset` (a fixed
RNG seed and a fixed "planning epoch" make the dataset byte-for-byte stable
across restarts and resets).

- **50 clients** (`CUST-001`…`CUST-050`).
- **~132 goals** across all seven goal types, 1–4 per client, deliberately mixed
  across `ON_TRACK` / `AT_RISK` / `OFF_TRACK`.
- **40 plans** (one per client for the first 40 clients).
- **~220 assets/liabilities** (3–6 per client) producing plausible net worth.
- **Showcase clients** with clean, story-friendly numbers:
  - `CUST-001` (Sarah Chen, 40, MODERATE) — retirement **AT_RISK**, college
    **ON_TRACK**.
  - `CUST-002` (Marcus Johnson, 52, CONSERVATIVE) — a stretched retirement.
  - `CUST-003` (Elena Rodriguez, 34, AGGRESSIVE) — aggressive early-retirement
    plan.

### Client ID alignment

Client IDs use the **`CUST-001`…`CUST-050`** scheme, matching the
PortfolioManagement demo's `customerId` values (`CUST-` + 3 digits, 50 records —
verified against `PortfolioManagement/server/data/customers.json`), so
cross-service demos stay coherent. This system keeps the PRD field name
`clientId` but reuses those exact ID values. It is **self-contained** — it holds
its own seed data and never calls a sibling service at runtime; only the **IDs**
align. Some investment/retirement assets carry an illustrative `linkedAccountId`
(e.g. `ACCT-001-1`) derived from the aligned customer id; PortfolioManagement
does not publish a standalone account-id scheme, so treat that link as
demonstrative.

---

## Deployment (Heroku)

Heroku-ready as a single web dyno: `Procfile` present, binds to `process.env.PORT`,
`engines.node >= 18` set in `package.json`. No database add-on is required
(in-memory store) — **do not** provision Postgres. No secrets or config are
needed for the app to run.

Replace the placeholders `<app-name>` and `<your-heroku-team>` with your own
values.

```bash
# Create the app inside your Heroku team
heroku create <app-name> --team <your-heroku-team>

# Deploy
git push heroku main

# Scale the web dyno
heroku ps:scale web=1 --app <app-name>

# (Optional) production mode
heroku config:set NODE_ENV=production --app <app-name>

# Open it
heroku open --app <app-name>
```

Verify the live deploy:

- `GET https://<app-name>.herokuapp.com/api/v1/health` → `{ "status": "ok" }`
- Swagger UI at `/docs`
- MCP server at `/mcp` (and `/mcp/health`)
- `POST /api/v1/demo/reset` restores seed data

---

## License

MIT © Howie Rothstein
