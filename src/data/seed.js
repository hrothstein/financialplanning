/**
 * Seed data generator (PRD §7).
 *
 * Produces a self-contained, demo-ready dataset on boot and again on
 * POST /api/v1/demo/reset. A FIXED RNG seed makes the dataset identical every
 * time, so demo numbers are stable across restarts and resets.
 *
 * Client IDs are aligned to the PortfolioManagement sibling repo, which uses
 * `CUST-001`…`CUST-050` (field `customerId`, `CUST-` + 3 digits, 50 records —
 * confirmed against PortfolioManagement/server/data/customers.json). We keep
 * the PRD field name `clientId` but reuse those exact ID VALUES so cross-service
 * demos line up.
 *
 * The generator reuses the pure projection helpers to back-solve each goal's
 * monthly contribution toward a chosen "funded ratio", which lets us
 * deliberately spread goals across ON_TRACK / AT_RISK / OFF_TRACK.
 */

import { RISK_PROFILES, DEFAULT_INFLATION_RATE, returnRateFor } from '../config.js';
import {
  yearsBetween,
  futureValueLumpSum,
  requiredMonthlyPayment,
} from '../services/projectionEngine.js';
import { mulberry32 } from '../services/monteCarloEngine.js';

/** Fixed seed — the whole point of stable demo numbers. */
const SEED = 20260101;

/**
 * Fixed "planning epoch". All seed dates (target dates, created/updated
 * timestamps) are derived from this constant rather than the live clock, so
 * every reset regenerates a byte-for-byte identical dataset (PRD §7: stable
 * across restart and demo/reset). Runtime projections still default to the
 * real current date, which is essentially this epoch at build time and drifts
 * only slowly afterward — acceptable for a demo.
 */
const EPOCH = new Date('2026-08-17T00:00:00.000Z');

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Charles', 'Karen', 'Christopher', 'Nancy', 'Daniel', 'Lisa',
  'Matthew', 'Betty', 'Anthony', 'Margaret', 'Mark', 'Sandra', 'Donald', 'Ashley',
  'Steven', 'Kimberly', 'Paul', 'Emily', 'Andrew', 'Donna', 'Joshua', 'Michelle',
  'Kenneth', 'Carol', 'Kevin', 'Amanda', 'Brian', 'Dorothy', 'George', 'Melissa',
  'Timothy', 'Deborah',
];

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson', 'Walker',
  'Young', 'Allen', 'King', 'Wright', 'Scott', 'Torres', 'Nguyen', 'Hill', 'Flores',
  'Green', 'Adams', 'Nelson', 'Baker', 'Hall', 'Rivera', 'Campbell', 'Mitchell',
  'Carter', 'Roberts',
];

const FILING_STATUSES = ['SINGLE', 'MARRIED_JOINT', 'MARRIED_SEPARATE', 'HEAD_OF_HOUSEHOLD'];
const RISK_TOLERANCES = Object.keys(RISK_PROFILES);
const PRIORITIES = ['HIGH', 'MEDIUM', 'LOW'];

const ASSET_CATEGORIES = ['INVESTMENT', 'CASH', 'REAL_ESTATE', 'RETIREMENT_ACCOUNT', 'OTHER'];
const LIABILITY_CATEGORIES = ['MORTGAGE', 'STUDENT_LOAN', 'CREDIT_CARD', 'AUTO_LOAN', 'OTHER'];

const CLIENT_COUNT = 50;

/**
 * Client ID for index i (1-based), matching PortfolioManagement's
 * `CUST-001`…`CUST-050` scheme (`CUST-` + 3-digit zero-padded).
 */
const clientIdFor = (i) => `CUST-${String(i).padStart(3, '0')}`;

/** Build a set of small RNG helpers bound to a single seeded stream. */
function makeRandom(seed) {
  const rng = mulberry32(seed);
  const randFloat = (min, max) => min + rng() * (max - min);
  const randInt = (min, max) => Math.floor(randFloat(min, max + 1));
  const pick = (arr) => arr[randInt(0, arr.length - 1)];
  const chance = (p) => rng() < p;
  const round2 = (v) => Math.round(v * 100) / 100;
  return { rng, randFloat, randInt, pick, chance, round2 };
}

/** Per goal type: horizon range (years), rough target range, and a label. */
const GOAL_TEMPLATES = {
  RETIREMENT: { years: [12, 35], target: [800000, 3000000], names: ['Retirement', 'Retire Comfortably', 'Retirement Nest Egg'] },
  EDUCATION: { years: [4, 18], target: [80000, 350000], names: ["Kid's College", 'College Fund', 'University Tuition', "Daughter's Education"] },
  HOME_PURCHASE: { years: [2, 8], target: [80000, 300000], names: ['Home Down Payment', 'First Home', 'Vacation Home'] },
  MAJOR_PURCHASE: { years: [1, 6], target: [30000, 150000], names: ['New Car', 'Boat', 'Kitchen Remodel', 'Dream Vacation'] },
  EMERGENCY_FUND: { years: [1, 3], target: [15000, 60000], names: ['Emergency Fund', 'Rainy Day Fund', '6-Month Cushion'] },
  WEALTH_ACCUMULATION: { years: [8, 25], target: [250000, 1500000], names: ['Wealth Building', 'Financial Independence', 'Investment Growth'] },
  LEGACY: { years: [15, 35], target: [300000, 2000000], names: ['Legacy Gift', 'Estate for Heirs', 'Charitable Legacy'] },
};

const GOAL_TYPES = Object.keys(GOAL_TEMPLATES);

/**
 * Given a desired funded ratio, back-solve the monthly contribution so the
 * deterministic projection lands near that ratio. Keeps our status mix
 * intentional rather than accidental.
 */
function contributionForFundedRatio({ fundedRatio, currentSavings, targetAmount, inTodaysDollars, returnRate, years, now }) {
  const targetDate = new Date(now.getTime());
  targetDate.setFullYear(targetDate.getFullYear() + Math.round(years));
  const yrs = yearsBetween(now, targetDate);
  const adjustedTarget = inTodaysDollars
    ? targetAmount * Math.pow(1 + DEFAULT_INFLATION_RATE, yrs)
    : targetAmount;
  const fvSavings = futureValueLumpSum(currentSavings, returnRate, yrs);
  const desiredProjected = fundedRatio * adjustedTarget;
  const fvContribNeeded = Math.max(desiredProjected - fvSavings, 0);
  const monthly = requiredMonthlyPayment(fvContribNeeded, returnRate, yrs);
  return { monthly: Math.max(0, monthly), targetDate };
}

/**
 * Pick a target funded ratio from a demo-friendly distribution so the seed
 * contains a healthy spread of all three statuses.
 *   ~38% ON_TRACK (>=1.0), ~30% AT_RISK ([0.8,1.0)), ~32% OFF_TRACK (<0.8)
 */
function pickFundedRatio(rand) {
  const roll = rand.rng();
  if (roll < 0.38) return rand.randFloat(1.0, 1.35); // ON_TRACK
  if (roll < 0.68) return rand.randFloat(0.8, 0.99); // AT_RISK
  return rand.randFloat(0.45, 0.79); // OFF_TRACK
}

/** Hand-tuned showcase clients (CUST-001..003) with clean, story-friendly numbers. */
function buildShowcaseClients() {
  return [
    {
      clientId: 'CUST-001',
      firstName: 'Sarah',
      lastName: 'Chen',
      age: 40,
      retirementAge: 65,
      annualIncome: 185000,
      filingStatus: 'MARRIED_JOINT',
      riskTolerance: 'MODERATE',
      _showcase: true,
      // A retirement goal that's AT_RISK and a college goal that's ON_TRACK.
      _goals: [
        { type: 'RETIREMENT', name: 'Retirement', targetAmount: 2000000, inTodaysDollars: true, years: 25, currentSavings: 320000, fundedRatio: 0.9, priority: 'HIGH' },
        { type: 'EDUCATION', name: "Kids' College", targetAmount: 200000, inTodaysDollars: true, years: 12, currentSavings: 60000, fundedRatio: 1.05, priority: 'HIGH' },
        { type: 'EMERGENCY_FUND', name: 'Emergency Fund', targetAmount: 45000, inTodaysDollars: false, years: 2, currentSavings: 30000, fundedRatio: 1.1, priority: 'MEDIUM' },
      ],
    },
    {
      clientId: 'CUST-002',
      firstName: 'Marcus',
      lastName: 'Johnson',
      age: 52,
      retirementAge: 67,
      annualIncome: 240000,
      filingStatus: 'MARRIED_JOINT',
      riskTolerance: 'CONSERVATIVE',
      _showcase: true,
      _goals: [
        { type: 'RETIREMENT', name: 'Retirement', targetAmount: 2500000, inTodaysDollars: true, years: 15, currentSavings: 900000, fundedRatio: 0.72, priority: 'HIGH' },
        { type: 'HOME_PURCHASE', name: 'Vacation Home', targetAmount: 250000, inTodaysDollars: false, years: 5, currentSavings: 120000, fundedRatio: 0.95, priority: 'MEDIUM' },
        { type: 'LEGACY', name: 'Legacy for Grandkids', targetAmount: 500000, inTodaysDollars: true, years: 20, currentSavings: 100000, fundedRatio: 1.0, priority: 'LOW' },
      ],
    },
    {
      clientId: 'CUST-003',
      firstName: 'Elena',
      lastName: 'Rodriguez',
      age: 34,
      retirementAge: 65,
      annualIncome: 120000,
      filingStatus: 'SINGLE',
      riskTolerance: 'AGGRESSIVE',
      _showcase: true,
      _goals: [
        { type: 'RETIREMENT', name: 'Early Retirement', targetAmount: 1800000, inTodaysDollars: true, years: 31, currentSavings: 150000, fundedRatio: 1.15, priority: 'HIGH' },
        { type: 'HOME_PURCHASE', name: 'First Home', targetAmount: 120000, inTodaysDollars: false, years: 3, currentSavings: 40000, fundedRatio: 0.85, priority: 'HIGH' },
        { type: 'WEALTH_ACCUMULATION', name: 'Financial Independence', targetAmount: 750000, inTodaysDollars: true, years: 18, currentSavings: 90000, fundedRatio: 0.65, priority: 'MEDIUM' },
      ],
    },
  ];
}

/**
 * Generate the full seed dataset.
 * @returns {{clients, goals, plans, items, counters}}
 */
export function generateSeedData() {
  const rand = makeRandom(SEED);
  const now = new Date(EPOCH.getTime());

  const clients = [];
  const goals = [];
  const plans = [];
  const items = [];

  let goalNum = 0;
  let planNum = 0;
  let itemNum = 0;

  const nextGoalId = () => `GOAL-${String((goalNum += 1)).padStart(5, '0')}`;
  const nextPlanId = () => `PLAN-${String((planNum += 1)).padStart(5, '0')}`;
  const nextItemId = (kind) =>
    `${kind === 'LIABILITY' ? 'LIAB' : 'ASSET'}-${String((itemNum += 1)).padStart(5, '0')}`;

  // ISO datetime a few months back so createdAt/updatedAt look plausible.
  const createdBase = new Date(now.getTime());
  createdBase.setMonth(createdBase.getMonth() - 6);
  const createdAtIso = createdBase.toISOString();

  const showcase = buildShowcaseClients();

  // Build one client's goals from a spec list (used for showcase clients).
  function buildGoalsFromSpecs(client, specs) {
    return specs.map((s) => {
      const returnRate = returnRateFor(client.riskTolerance);
      const { monthly, targetDate } = contributionForFundedRatio({
        fundedRatio: s.fundedRatio,
        currentSavings: s.currentSavings,
        targetAmount: s.targetAmount,
        inTodaysDollars: s.inTodaysDollars,
        returnRate,
        years: s.years,
        now,
      });
      return {
        goalId: nextGoalId(),
        clientId: client.clientId,
        type: s.type,
        name: s.name,
        targetAmount: Math.round(s.targetAmount),
        inTodaysDollars: s.inTodaysDollars,
        targetDate: targetDate.toISOString().slice(0, 10),
        currentSavings: Math.round(s.currentSavings),
        monthlyContribution: Math.round(monthly),
        priority: s.priority,
        expectedReturnRate: Math.round(returnRate * 10000) / 10000,
        createdAt: createdAtIso,
        updatedAt: createdAtIso,
      };
    });
  }

  // --- Clients 1..50 (first three are the tuned showcase clients) ---
  for (let i = 1; i <= CLIENT_COUNT; i += 1) {
    const clientId = clientIdFor(i);
    let client;
    let clientGoals;

    const preset = showcase.find((s) => s.clientId === clientId);
    if (preset) {
      const { _goals, _showcase, ...clientFields } = preset;
      client = clientFields;
      clientGoals = buildGoalsFromSpecs(client, _goals);
    } else {
      const riskTolerance = rand.pick(RISK_TOLERANCES);
      const age = rand.randInt(28, 62);
      client = {
        clientId,
        firstName: rand.pick(FIRST_NAMES),
        lastName: rand.pick(LAST_NAMES),
        age,
        retirementAge: rand.pick([62, 65, 65, 65, 67, 70]),
        annualIncome: rand.randInt(6, 40) * 10000, // 60k..400k
        filingStatus: rand.pick(FILING_STATUSES),
        riskTolerance,
      };

      // 1–4 goals, always including RETIREMENT plus a mix of others.
      const goalCount = rand.randInt(1, 4);
      const chosenTypes = ['RETIREMENT'];
      while (chosenTypes.length < goalCount) {
        const t = rand.pick(GOAL_TYPES);
        chosenTypes.push(t); // duplicates allowed (e.g. two education goals) — realistic
      }

      const returnRate = returnRateFor(riskTolerance);
      clientGoals = chosenTypes.map((type) => {
        const tpl = GOAL_TEMPLATES[type];
        const years = rand.randInt(tpl.years[0], tpl.years[1]);
        // Cap retirement horizon at the client's actual years-to-retirement.
        const cappedYears =
          type === 'RETIREMENT' ? Math.max(3, Math.min(years, client.retirementAge - age)) : years;
        const targetAmount = rand.randInt(tpl.target[0] / 1000, tpl.target[1] / 1000) * 1000;
        const inTodaysDollars = rand.chance(0.6);
        const currentSavings = Math.round(targetAmount * rand.randFloat(0.02, 0.45));
        const fundedRatio = pickFundedRatio(rand);
        const { monthly, targetDate } = contributionForFundedRatio({
          fundedRatio,
          currentSavings,
          targetAmount,
          inTodaysDollars,
          returnRate,
          years: cappedYears,
          now,
        });
        return {
          goalId: nextGoalId(),
          clientId,
          type,
          name: rand.pick(tpl.names),
          targetAmount,
          inTodaysDollars,
          targetDate: targetDate.toISOString().slice(0, 10),
          currentSavings,
          monthlyContribution: Math.round(monthly),
          priority: rand.pick(PRIORITIES),
          expectedReturnRate: Math.round(returnRate * 10000) / 10000,
          createdAt: createdAtIso,
          updatedAt: createdAtIso,
        };
      });
    }

    clients.push(client);
    goals.push(...clientGoals);

    // --- Assets / liabilities: 3–6 per client ---
    const itemCount = rand.randInt(3, 6);
    // Guarantee at least one asset and skew toward assets so net worth is positive-ish.
    for (let k = 0; k < itemCount; k += 1) {
      const isLiability = k > 0 && rand.chance(0.4);
      if (isLiability) {
        const category = rand.pick(LIABILITY_CATEGORIES);
        const value =
          category === 'MORTGAGE'
            ? rand.randInt(120, 650) * 1000
            : category === 'STUDENT_LOAN'
              ? rand.randInt(8, 90) * 1000
              : category === 'AUTO_LOAN'
                ? rand.randInt(6, 45) * 1000
                : rand.randInt(1, 20) * 1000;
        items.push({
          itemId: nextItemId('LIABILITY'),
          clientId,
          kind: 'LIABILITY',
          category,
          description: {
            MORTGAGE: 'Primary residence mortgage',
            STUDENT_LOAN: 'Student loan balance',
            CREDIT_CARD: 'Credit card balance',
            AUTO_LOAN: 'Auto loan',
            OTHER: 'Other liability',
          }[category],
          value,
        });
      } else {
        const category = rand.pick(ASSET_CATEGORIES);
        const value =
          category === 'REAL_ESTATE'
            ? rand.randInt(200, 1200) * 1000
            : category === 'RETIREMENT_ACCOUNT'
              ? rand.randInt(40, 900) * 1000
              : category === 'INVESTMENT'
                ? rand.randInt(20, 700) * 1000
                : category === 'CASH'
                  ? rand.randInt(5, 120) * 1000
                  : rand.randInt(3, 60) * 1000;
        const item = {
          itemId: nextItemId('ASSET'),
          clientId,
          kind: 'ASSET',
          category,
          description: {
            INVESTMENT: 'Brokerage investment account',
            CASH: 'Savings / cash reserves',
            REAL_ESTATE: 'Primary residence (market value)',
            RETIREMENT_ACCOUNT: '401(k) / IRA balance',
            OTHER: 'Other asset',
          }[category],
          value,
        };
        // Link investment / retirement accounts to a PortfolioManagement-style
        // account id for a subset. PortfolioManagement exposes accounts under a
        // customer but ships no standalone account-id scheme, so this derives an
        // illustrative id from the aligned customer id (documented in README).
        if ((category === 'INVESTMENT' || category === 'RETIREMENT_ACCOUNT') && rand.chance(0.6)) {
          item.linkedAccountId = `ACCT-${String(i).padStart(3, '0')}-${k}`;
        }
        items.push(item);
      }
    }
  }

  // --- Plans: ~40, one per client for the first 40 clients ---
  const PLAN_COUNT = 40;
  const currentYear = now.getFullYear();
  for (let i = 1; i <= PLAN_COUNT; i += 1) {
    const clientId = clientIdFor(i);
    const client = clients.find((c) => c.clientId === clientId);
    const clientGoalIds = goals.filter((g) => g.clientId === clientId).map((g) => g.goalId);
    // Showcase clients (and most others) get ACTIVE plans; a few DRAFT/ARCHIVED.
    const status = i <= 3 ? 'ACTIVE' : rand.pick(['ACTIVE', 'ACTIVE', 'ACTIVE', 'DRAFT', 'ARCHIVED']);
    plans.push({
      planId: nextPlanId(),
      clientId,
      name: `${currentYear} Financial Plan`,
      goalIds: clientGoalIds,
      assumptions: {
        inflationRate: DEFAULT_INFLATION_RATE,
        defaultReturnRate: returnRateFor(client.riskTolerance),
        socialSecurityMonthly: rand.randInt(15, 38) * 100, // $1,500–$3,800/mo
        lifeExpectancy: rand.pick([88, 90, 92, 95]),
      },
      status,
      createdAt: createdAtIso,
      updatedAt: createdAtIso,
    });
  }

  return {
    clients,
    goals,
    plans,
    items,
    counters: { goal: goalNum, plan: planNum, item: itemNum },
  };
}
