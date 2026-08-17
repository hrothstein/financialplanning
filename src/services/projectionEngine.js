/**
 * Deterministic goal projection engine (PRD §4.2).
 *
 * Pure functions only — no store access, no I/O — so they are trivially
 * unit-testable. All math uses standard time-value-of-money formulas.
 * Monetary values are plain USD numbers. Rates are decimals (0.065 = 6.5%).
 */

import {
  DEFAULT_INFLATION_RATE,
  STATUS_THRESHOLDS,
  returnRateFor,
} from '../config.js';

/** Milliseconds in an average year (365.25 days) — used for date math. */
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/**
 * Fractional years between two dates. Never negative — a target already in
 * the past yields 0 (the goal is due now).
 */
export function yearsBetween(fromDate, toDate) {
  const years = (toDate.getTime() - fromDate.getTime()) / MS_PER_YEAR;
  return years > 0 ? years : 0;
}

/**
 * Future value of a present lump sum: FV = PV * (1 + r)^n.
 * @param {number} pv present value
 * @param {number} annualRate annual return (decimal)
 * @param {number} years number of years (may be fractional)
 */
export function futureValueLumpSum(pv, annualRate, years) {
  return pv * Math.pow(1 + annualRate, years);
}

/**
 * Future value of a stream of equal monthly contributions (ordinary annuity):
 *   FV = PMT * [((1 + r_m)^m - 1) / r_m]
 * where r_m is the monthly rate and m is the number of months.
 *
 * Falls back to PMT * m when the rate is ~0 to avoid division by zero.
 */
export function futureValueAnnuity(monthlyContribution, annualRate, years) {
  const months = years * 12;
  const monthlyRate = annualRate / 12;
  if (Math.abs(monthlyRate) < 1e-12) {
    return monthlyContribution * months;
  }
  return monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
}

/**
 * Solve an ordinary annuity for the monthly payment needed to reach a future
 * value: PMT = FV * r_m / ((1 + r_m)^m - 1).
 * Falls back to FV / m when the rate is ~0.
 */
export function requiredMonthlyPayment(futureValueNeeded, annualRate, years) {
  const months = years * 12;
  if (months <= 0) return 0;
  const monthlyRate = annualRate / 12;
  if (Math.abs(monthlyRate) < 1e-12) {
    return futureValueNeeded / months;
  }
  return (futureValueNeeded * monthlyRate) / (Math.pow(1 + monthlyRate, months) - 1);
}

/** Map a funded percentage to a goal status using the PRD §4.2 thresholds. */
export function statusForFundedPercentage(fundedPercentage) {
  if (fundedPercentage >= STATUS_THRESHOLDS.ON_TRACK) return 'ON_TRACK';
  if (fundedPercentage >= STATUS_THRESHOLDS.AT_RISK) return 'AT_RISK';
  return 'OFF_TRACK';
}

/** Round to `dp` decimal places, returning a finite number (0 for NaN/Inf). */
function round(value, dp = 2) {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

/**
 * Run the deterministic projection for a goal.
 *
 * @param {object} goal   the goal entity
 * @param {object} client the owning client (for risk-derived default return)
 * @param {object} [opts]
 * @param {Date}   [opts.asOf]           valuation date (default: now)
 * @param {number} [opts.inflationRate]  override inflation (default 2.5%)
 * @returns {object} projection result matching the PRD §5 response shape
 */
export function projectGoal(goal, client, opts = {}) {
  const asOf = opts.asOf ?? new Date();
  const inflationRate = opts.inflationRate ?? DEFAULT_INFLATION_RATE;

  // Return rate: explicit on the goal, else derived from client risk tolerance.
  const expectedReturnRate =
    typeof goal.expectedReturnRate === 'number'
      ? goal.expectedReturnRate
      : returnRateFor(client?.riskTolerance);

  const years = yearsBetween(asOf, new Date(goal.targetDate));

  const fvSavings = futureValueLumpSum(goal.currentSavings ?? 0, expectedReturnRate, years);
  const fvContrib = futureValueAnnuity(goal.monthlyContribution ?? 0, expectedReturnRate, years);
  const projectedAmount = fvSavings + fvContrib;

  // Inflate the target into future dollars only when it was given in today's dollars.
  const adjustedTargetAmount = goal.inTodaysDollars
    ? goal.targetAmount * Math.pow(1 + inflationRate, years)
    : goal.targetAmount;

  const fundedPercentage = adjustedTargetAmount > 0 ? projectedAmount / adjustedTargetAmount : 0;
  const status = statusForFundedPercentage(fundedPercentage);

  // Advice: monthly contribution needed to fully fund the goal. The lump sum
  // already grows on its own, so only the remaining shortfall must be funded
  // by contributions.
  const fvShortfall = Math.max(adjustedTargetAmount - fvSavings, 0);
  const requiredMonthlyContribution = requiredMonthlyPayment(fvShortfall, expectedReturnRate, years);
  const currentMonthlyContribution = goal.monthlyContribution ?? 0;
  const monthlyShortfall = Math.max(requiredMonthlyContribution - currentMonthlyContribution, 0);

  return {
    goalId: goal.goalId,
    clientId: goal.clientId,
    type: goal.type,
    yearsToTarget: round(years, 1),
    assumptions: {
      expectedReturnRate: round(expectedReturnRate, 4),
      inflationRate: round(inflationRate, 4),
    },
    targetAmount: round(goal.targetAmount),
    adjustedTargetAmount: round(adjustedTargetAmount),
    projectedAmount: round(projectedAmount),
    fundedPercentage: round(fundedPercentage, 3),
    status,
    currentMonthlyContribution: round(currentMonthlyContribution),
    requiredMonthlyContribution: round(requiredMonthlyContribution),
    monthlyShortfall: round(monthlyShortfall),
  };
}
