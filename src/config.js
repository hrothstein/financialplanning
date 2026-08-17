/**
 * Shared assumptions and constants for the Financial Planning System.
 *
 * These are the "house view" defaults an advisor demo leans on. They are
 * referenced by both the calculation engines (services/) and the seed
 * generator so projected numbers stay internally consistent. See PRD §4.1.
 */

/**
 * Default capital-market assumptions by client risk tolerance.
 * `return` = expected annual return; `volatility` = annual std dev (used by
 * the Monte Carlo engine). Aligned with the RiskManagement sibling repo's
 * CONSERVATIVE / MODERATE / AGGRESSIVE buckets.
 */
export const RISK_PROFILES = {
  CONSERVATIVE: { return: 0.045, volatility: 0.06 },
  MODERATE: { return: 0.065, volatility: 0.11 },
  AGGRESSIVE: { return: 0.085, volatility: 0.16 },
};

/** Default annual inflation rate used to inflate today's-dollar targets. */
export const DEFAULT_INFLATION_RATE = 0.025;

/** Fallback expected return when risk tolerance is missing/unknown. */
export const FALLBACK_RETURN_RATE = RISK_PROFILES.MODERATE.return;

/** Fallback volatility when risk tolerance is missing/unknown. */
export const FALLBACK_VOLATILITY = RISK_PROFILES.MODERATE.volatility;

/**
 * Funded-percentage thresholds that map a projection to a goal status.
 * ON_TRACK >= 1.0; AT_RISK in [0.8, 1.0); OFF_TRACK < 0.8. See PRD §4.2.
 */
export const STATUS_THRESHOLDS = {
  ON_TRACK: 1.0,
  AT_RISK: 0.8,
};

/** Monte Carlo defaults. Iterations are capped to keep demo latency sane. */
export const MONTE_CARLO = {
  DEFAULT_ITERATIONS: 1000,
  MAX_ITERATIONS: 10000,
  DEFAULT_SEED: 42,
};

/** Expected return for a risk tolerance, with a safe fallback. */
export function returnRateFor(riskTolerance) {
  return RISK_PROFILES[riskTolerance]?.return ?? FALLBACK_RETURN_RATE;
}

/** Volatility for a risk tolerance, with a safe fallback. */
export function volatilityFor(riskTolerance) {
  return RISK_PROFILES[riskTolerance]?.volatility ?? FALLBACK_VOLATILITY;
}
