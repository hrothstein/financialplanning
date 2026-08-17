/**
 * In-memory datastore for the Financial Planning System.
 *
 * Demo-grade: all data lives in process memory and resets on restart.
 * `reset()` regenerates the identical seed set (the seed uses a fixed RNG
 * seed, so numbers are stable across restarts and demo resets).
 *
 * No database. No persistence. See PRD §2.
 */

import { generateSeedData } from './seed.js';

/**
 * The live store. Each collection is a Map keyed by the entity's id string,
 * which gives O(1) lookups for the `/:id` routes while still being easy to
 * iterate for list endpoints.
 */
export const store = {
  clients: new Map(),
  goals: new Map(),
  plans: new Map(),
  items: new Map(), // assets + liabilities, keyed by itemId
};

/**
 * Monotonic counters used to mint new ids for entities created at runtime
 * (POST routes). Seeded entities reserve the low numbers; these start above
 * the seed range so runtime ids never collide with seed ids.
 */
export const counters = {
  goal: 0,
  plan: 0,
  item: 0,
};

/** Zero-pad a number to `width` digits (e.g. 7 -> "00007"). */
export function pad(num, width = 5) {
  return String(num).padStart(width, '0');
}

/** Mint the next goal id, e.g. GOAL-00121. */
export function nextGoalId() {
  counters.goal += 1;
  return `GOAL-${pad(counters.goal)}`;
}

/** Mint the next plan id, e.g. PLAN-00041. */
export function nextPlanId() {
  counters.plan += 1;
  return `PLAN-${pad(counters.plan)}`;
}

/** Mint the next asset/liability id, e.g. ASSET-00201 / LIAB-00201. */
export function nextItemId(kind) {
  counters.item += 1;
  const prefix = kind === 'LIABILITY' ? 'LIAB' : 'ASSET';
  return `${prefix}-${pad(counters.item)}`;
}

/**
 * Load (or reload) the store from a freshly generated seed set.
 * Called once on boot and again by POST /api/v1/demo/reset.
 */
export function reset() {
  const seed = generateSeedData();

  store.clients = new Map(seed.clients.map((c) => [c.clientId, c]));
  store.goals = new Map(seed.goals.map((g) => [g.goalId, g]));
  store.plans = new Map(seed.plans.map((p) => [p.planId, p]));
  store.items = new Map(seed.items.map((i) => [i.itemId, i]));

  // Advance counters past the highest seeded id so runtime creates don't collide.
  counters.goal = seed.counters.goal;
  counters.plan = seed.counters.plan;
  counters.item = seed.counters.item;

  return {
    clients: store.clients.size,
    goals: store.goals.size,
    plans: store.plans.size,
    items: store.items.size,
  };
}
