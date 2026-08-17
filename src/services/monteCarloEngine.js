/**
 * Monte Carlo simulation engine (PRD §4.3).
 *
 * Simulates the ending balance of a goal by drawing annual returns from a
 * normal distribution N(expectedReturn, volatility) over the years to target,
 * compounding the current savings plus monthly contributions year by year.
 *
 * Deterministic for demos: the RNG is seeded, so the same (seed, iterations)
 * always yields identical numbers across restarts. Pure — no I/O.
 */

import {
  DEFAULT_INFLATION_RATE,
  MONTE_CARLO,
  returnRateFor,
  volatilityFor,
} from '../config.js';
import { yearsBetween } from './projectionEngine.js';

/**
 * Mulberry32 — a small, fast, seedable PRNG. Given the same 32-bit seed it
 * always produces the same stream of uniforms in [0, 1). Good enough for a
 * demo; not cryptographic.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draw a standard-normal sample using the Box–Muller transform, given a
 * uniform generator. Guards against log(0) by nudging u1 off zero.
 */
export function boxMuller(rng) {
  let u1 = rng();
  const u2 = rng();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Simulate a single ending balance over `years` whole periods.
 * Annual return each year ~ N(mean, stdDev). Contributions are added as a
 * yearly lump (12 * monthlyContribution) — a reasonable demo approximation.
 * A fractional final year scales both growth and contribution proportionally.
 */
function simulateOnce(rng, { currentSavings, monthlyContribution, years, mean, stdDev }) {
  let balance = currentSavings;
  let remaining = years;
  while (remaining > 0) {
    const slice = Math.min(1, remaining);
    const annualReturn = mean + stdDev * boxMuller(rng);
    // Grow the existing balance for this (possibly partial) year.
    balance *= Math.pow(1 + annualReturn, slice);
    // Add this period's contributions (scaled for a partial year).
    balance += monthlyContribution * 12 * slice;
    remaining -= slice;
  }
  return balance;
}

/** Nearest-rank percentile of an ascending-sorted array. */
function percentile(sortedAsc, p) {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.round((p / 100) * (sortedAsc.length - 1))));
  return sortedAsc[idx];
}

/**
 * Run a Monte Carlo simulation for a single goal.
 *
 * @param {object} goal   the goal entity
 * @param {object} client owning client (for risk-derived return/volatility)
 * @param {object} [opts]
 * @param {number} [opts.iterations] iteration count (default 1000, cap 10000)
 * @param {number} [opts.seed]       RNG seed (default 42)
 * @param {Date}   [opts.asOf]       valuation date (default now)
 * @param {number} [opts.inflationRate] override inflation for target adjustment
 * @returns {object} result matching the PRD §5 Monte Carlo response shape
 */
export function runMonteCarlo(goal, client, opts = {}) {
  const iterations = Math.min(
    MONTE_CARLO.MAX_ITERATIONS,
    Math.max(1, Math.floor(opts.iterations || MONTE_CARLO.DEFAULT_ITERATIONS)),
  );
  const seed = Number.isFinite(opts.seed) ? Math.floor(opts.seed) : MONTE_CARLO.DEFAULT_SEED;
  const asOf = opts.asOf ?? new Date();
  const inflationRate = opts.inflationRate ?? DEFAULT_INFLATION_RATE;

  const mean =
    typeof goal.expectedReturnRate === 'number'
      ? goal.expectedReturnRate
      : returnRateFor(client?.riskTolerance);
  const stdDev = volatilityFor(client?.riskTolerance);

  const years = yearsBetween(asOf, new Date(goal.targetDate));
  const adjustedTarget = goal.inTodaysDollars
    ? goal.targetAmount * Math.pow(1 + inflationRate, years)
    : goal.targetAmount;

  const rng = mulberry32(seed);
  const endings = new Array(iterations);
  let successes = 0;
  for (let i = 0; i < iterations; i += 1) {
    const ending = simulateOnce(rng, {
      currentSavings: goal.currentSavings ?? 0,
      monthlyContribution: goal.monthlyContribution ?? 0,
      years,
      mean,
      stdDev,
    });
    endings[i] = ending;
    if (ending >= adjustedTarget) successes += 1;
  }

  endings.sort((a, b) => a - b);
  const roundK = (v) => Math.round(v / 1000) * 1000; // round to nearest $1k for clean demo numbers

  return {
    goalId: goal.goalId,
    clientId: goal.clientId,
    iterations,
    seed,
    yearsToTarget: Math.round(years * 10) / 10,
    probabilityOfSuccess: Math.round((successes / iterations) * 100) / 100,
    targetAmount: roundK(adjustedTarget),
    percentiles: {
      p10: roundK(percentile(endings, 10)),
      p25: roundK(percentile(endings, 25)),
      p50: roundK(percentile(endings, 50)),
      p75: roundK(percentile(endings, 75)),
      p90: roundK(percentile(endings, 90)),
    },
  };
}
