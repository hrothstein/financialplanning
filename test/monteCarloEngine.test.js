/**
 * Unit tests for the Monte Carlo engine (PRD §4.3, §10.4).
 * Covers determinism (same seed → same result), iteration cap, percentile
 * ordering, and probability bounds.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mulberry32, boxMuller, runMonteCarlo } from '../src/services/monteCarloEngine.js';

const asOf = new Date('2026-01-01T00:00:00Z');
const client = { riskTolerance: 'MODERATE' };
const goal = {
  goalId: 'GOAL-MC1',
  clientId: 'CUST-001',
  type: 'RETIREMENT',
  targetAmount: 1000000,
  inTodaysDollars: false,
  targetDate: '2046-01-01',
  currentSavings: 100000,
  monthlyContribution: 1000,
  expectedReturnRate: 0.065,
};

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  for (let i = 0; i < 100; i += 1) assert.equal(a(), b());
});

test('mulberry32 produces uniforms in [0,1)', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 1000; i += 1) {
    const v = rng();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('boxMuller yields roughly standard-normal samples', () => {
  const rng = mulberry32(99);
  const n = 20000;
  let sum = 0;
  let sumSq = 0;
  for (let i = 0; i < n; i += 1) {
    const z = boxMuller(rng);
    sum += z;
    sumSq += z * z;
  }
  const mean = sum / n;
  const variance = sumSq / n - mean * mean;
  assert.ok(Math.abs(mean) < 0.05, `mean ${mean} not ~0`);
  assert.ok(Math.abs(variance - 1) < 0.1, `variance ${variance} not ~1`);
});

test('runMonteCarlo: same seed → identical result (determinism, §10.4)', () => {
  const r1 = runMonteCarlo(goal, client, { seed: 42, iterations: 1000, asOf });
  const r2 = runMonteCarlo(goal, client, { seed: 42, iterations: 1000, asOf });
  assert.deepEqual(r1, r2);
});

test('runMonteCarlo: different seeds → (generally) different probability', () => {
  const r1 = runMonteCarlo(goal, client, { seed: 1, iterations: 2000, asOf });
  const r2 = runMonteCarlo(goal, client, { seed: 2, iterations: 2000, asOf });
  // Not a hard guarantee, but with 2000 iters these should differ.
  assert.notEqual(
    `${r1.probabilityOfSuccess}-${r1.percentiles.p50}`,
    `${r2.probabilityOfSuccess}-${r2.percentiles.p50}`,
  );
});

test('runMonteCarlo: iterations are capped at 10000', () => {
  const r = runMonteCarlo(goal, client, { iterations: 999999, asOf });
  assert.equal(r.iterations, 10000);
});

test('runMonteCarlo: iterations default to 1000; fractional floors to an int >= 1', () => {
  assert.equal(runMonteCarlo(goal, client, { asOf }).iterations, 1000);
  assert.equal(runMonteCarlo(goal, client, { iterations: 0, asOf }).iterations, 1000); // 0 is falsy -> default
  assert.equal(runMonteCarlo(goal, client, { iterations: 1.9, asOf }).iterations, 1); // floored
  assert.equal(runMonteCarlo(goal, client, { iterations: 250, asOf }).iterations, 250);
});

test('runMonteCarlo: percentiles are monotonically non-decreasing', () => {
  const { percentiles: p } = runMonteCarlo(goal, client, { seed: 42, iterations: 2000, asOf });
  assert.ok(p.p10 <= p.p25);
  assert.ok(p.p25 <= p.p50);
  assert.ok(p.p50 <= p.p75);
  assert.ok(p.p75 <= p.p90);
});

test('runMonteCarlo: probabilityOfSuccess within [0,1]', () => {
  const r = runMonteCarlo(goal, client, { seed: 42, iterations: 1000, asOf });
  assert.ok(r.probabilityOfSuccess >= 0 && r.probabilityOfSuccess <= 1);
});

test('runMonteCarlo: default seed is stable across calls', () => {
  const r1 = runMonteCarlo(goal, client, { iterations: 500, asOf });
  const r2 = runMonteCarlo(goal, client, { iterations: 500, asOf });
  assert.equal(r1.seed, 42);
  assert.deepEqual(r1, r2);
});
