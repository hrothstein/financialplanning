/** Shared formatting + status helpers used across screens. */

export const fmtUSD = (n, opts = {}) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
    ...opts,
  }).format(Number.isFinite(n) ? n : 0);

export const fmtPct = (frac, dp = 0) =>
  `${(Number.isFinite(frac) ? frac * 100 : 0).toFixed(dp)}%`;

/** Map a goal/projection status to a display label + CSS color token. */
export const STATUS_META = {
  ON_TRACK: { label: 'On track', color: 'var(--ok)', bg: 'var(--ok-bg)' },
  AT_RISK: { label: 'At risk', color: 'var(--warn)', bg: 'var(--warn-bg)' },
  OFF_TRACK: { label: 'Off track', color: 'var(--bad)', bg: 'var(--bad-bg)' },
};

export const statusMeta = (status) => STATUS_META[status] || { label: status, color: 'var(--muted)', bg: '#eee' };

/** Color a funded percentage on the same ON/AT/OFF scale. */
export const fundedColor = (frac) => {
  if (frac >= 1) return 'var(--ok)';
  if (frac >= 0.8) return 'var(--warn)';
  return 'var(--bad)';
};

/** Human label for goal types. */
export const GOAL_TYPE_LABELS = {
  RETIREMENT: 'Retirement',
  EDUCATION: 'Education',
  HOME_PURCHASE: 'Home purchase',
  MAJOR_PURCHASE: 'Major purchase',
  EMERGENCY_FUND: 'Emergency fund',
  WEALTH_ACCUMULATION: 'Wealth accumulation',
  LEGACY: 'Legacy',
};

export const goalTypeLabel = (t) => GOAL_TYPE_LABELS[t] || t;

/** Category display labels for net worth breakdowns. */
export const CATEGORY_LABELS = {
  INVESTMENT: 'Investments',
  CASH: 'Cash',
  REAL_ESTATE: 'Real estate',
  RETIREMENT_ACCOUNT: 'Retirement accounts',
  OTHER: 'Other',
  MORTGAGE: 'Mortgage',
  STUDENT_LOAN: 'Student loans',
  CREDIT_CARD: 'Credit cards',
  AUTO_LOAN: 'Auto loans',
};

export const categoryLabel = (c) => CATEGORY_LABELS[c] || c;
