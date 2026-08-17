/**
 * Unit tests for the deterministic projection engine (PRD §4.2, §10.4).
 * Covers FV/annuity math, funded % thresholds, and required-contribution solve.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  futureValueLumpSum,
  futureValueAnnuity,
  requiredMonthlyPayment,
  statusForFundedPercentage,
  yearsBetween,
  projectGoal,
} from '../src/services/projectionEngine.js';

const approx = (actual, expected, tol = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${actual} ≈ ${expected} (tol ${tol})`);

test('futureValueLumpSum: FV = PV*(1+r)^n', () => {
  approx(futureValueLumpSum(1000, 0.05, 0), 1000);
  approx(futureValueLumpSum(1000, 0.05, 1), 1050);
  approx(futureValueLumpSum(1000, 0.05, 2), 1102.5);
  approx(futureValueLumpSum(1000, 0.1, 10), 1000 * Math.pow(1.1, 10), 1e-6);
});

test('futureValueAnnuity: ordinary annuity FV', () => {
  // $100/mo for 12 months at 12% annual (1%/mo) -> known annuity value.
  const expected = 100 * ((Math.pow(1.01, 12) - 1) / 0.01);
  approx(futureValueAnnuity(100, 0.12, 1), expected, 1e-6);
});

test('futureValueAnnuity: zero rate falls back to PMT * months', () => {
  approx(futureValueAnnuity(200, 0, 2), 200 * 24);
});

test('requiredMonthlyPayment inverts futureValueAnnuity', () => {
  const rate = 0.065;
  const years = 20;
  const pmt = 850;
  const fv = futureValueAnnuity(pmt, rate, years);
  const solved = requiredMonthlyPayment(fv, rate, years);
  approx(solved, pmt, 1e-6);
});

test('requiredMonthlyPayment: zero rate falls back to FV / months', () => {
  approx(requiredMonthlyPayment(24000, 0, 2), 1000);
});

test('requiredMonthlyPayment: zero/negative horizon returns 0', () => {
  assert.equal(requiredMonthlyPayment(100000, 0.06, 0), 0);
});

test('statusForFundedPercentage thresholds (§4.2)', () => {
  assert.equal(statusForFundedPercentage(1.0), 'ON_TRACK');
  assert.equal(statusForFundedPercentage(1.5), 'ON_TRACK');
  assert.equal(statusForFundedPercentage(0.999), 'AT_RISK');
  assert.equal(statusForFundedPercentage(0.8), 'AT_RISK');
  assert.equal(statusForFundedPercentage(0.7999), 'OFF_TRACK');
  assert.equal(statusForFundedPercentage(0), 'OFF_TRACK');
});

test('yearsBetween never negative; ~correct for one year', () => {
  const a = new Date('2026-01-01T00:00:00Z');
  const b = new Date('2027-01-01T00:00:00Z');
  approx(yearsBetween(a, b), 1, 0.01);
  assert.equal(yearsBetween(b, a), 0);
});

test('projectGoal: lump-sum-only goal, no inflation', () => {
  // 100k today, no contributions, 6% for exactly ~10 years, target 150k future dollars.
  const asOf = new Date('2026-01-01T00:00:00Z');
  const goal = {
    goalId: 'GOAL-T1',
    clientId: 'CUST-001',
    type: 'WEALTH_ACCUMULATION',
    targetAmount: 150000,
    inTodaysDollars: false,
    targetDate: '2036-01-01',
    currentSavings: 100000,
    monthlyContribution: 0,
    expectedReturnRate: 0.06,
  };
  const p = projectGoal(goal, { riskTolerance: 'MODERATE' }, { asOf });
  // ~10 years of 6% growth on 100k ≈ 179k -> funded > 1 -> ON_TRACK
  approx(p.projectedAmount, 100000 * Math.pow(1.06, p.yearsToTarget), 500);
  assert.equal(p.adjustedTargetAmount, 150000); // not inflated
  assert.equal(p.status, 'ON_TRACK');
  assert.equal(p.requiredMonthlyContribution, 0); // lump sum already covers it
});

test('projectGoal: inTodaysDollars inflates the target', () => {
  const asOf = new Date('2026-01-01T00:00:00Z');
  const goal = {
    goalId: 'GOAL-T2', clientId: 'CUST-001', type: 'RETIREMENT',
    targetAmount: 100000, inTodaysDollars: true, targetDate: '2036-01-01',
    currentSavings: 0, monthlyContribution: 0, expectedReturnRate: 0.05,
  };
  const p = projectGoal(goal, { riskTolerance: 'MODERATE' }, { asOf, inflationRate: 0.025 });
  approx(p.adjustedTargetAmount, 100000 * Math.pow(1.025, p.yearsToTarget), 50);
  assert.ok(p.adjustedTargetAmount > 100000);
});

test('projectGoal: default return derived from risk tolerance when omitted', () => {
  const asOf = new Date('2026-01-01T00:00:00Z');
  const goal = {
    goalId: 'GOAL-T3', clientId: 'CUST-001', type: 'RETIREMENT',
    targetAmount: 500000, inTodaysDollars: false, targetDate: '2046-01-01',
    currentSavings: 50000, monthlyContribution: 500,
    // no expectedReturnRate -> should use AGGRESSIVE 8.5%
  };
  const p = projectGoal(goal, { riskTolerance: 'AGGRESSIVE' }, { asOf });
  assert.equal(p.assumptions.expectedReturnRate, 0.085);
});

test('projectGoal: required contribution closes an underfunded gap', () => {
  const asOf = new Date('2026-01-01T00:00:00Z');
  const goal = {
    goalId: 'GOAL-T4', clientId: 'CUST-001', type: 'EDUCATION',
    targetAmount: 200000, inTodaysDollars: false, targetDate: '2044-01-01',
    currentSavings: 10000, monthlyContribution: 100, expectedReturnRate: 0.06,
  };
  const p = projectGoal(goal, { riskTolerance: 'MODERATE' }, { asOf });
  assert.ok(p.fundedPercentage < 1, 'goal should be underfunded');
  assert.ok(p.requiredMonthlyContribution > p.currentMonthlyContribution);
  approx(p.monthlyShortfall, p.requiredMonthlyContribution - p.currentMonthlyContribution, 0.01);

  // Feeding the required contribution back in should fully fund it (~100%).
  const fixed = projectGoal(
    { ...goal, monthlyContribution: p.requiredMonthlyContribution },
    { riskTolerance: 'MODERATE' },
    { asOf },
  );
  approx(fixed.fundedPercentage, 1.0, 0.01);
});

test('projectGoal: zero target amount does not divide by zero', () => {
  const asOf = new Date('2026-01-01T00:00:00Z');
  const goal = {
    goalId: 'GOAL-T5', clientId: 'CUST-001', type: 'OTHER',
    targetAmount: 0, inTodaysDollars: false, targetDate: '2030-01-01',
    currentSavings: 0, monthlyContribution: 0, expectedReturnRate: 0.05,
  };
  const p = projectGoal(goal, { riskTolerance: 'MODERATE' }, { asOf });
  assert.ok(Number.isFinite(p.fundedPercentage));
});
