/**
 * Unit tests for the portfolio (book-wide) aggregation service.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildPortfolioOverview } from '../src/services/portfolioService.js';

const clients = [
  { clientId: 'C1', firstName: 'Ann', lastName: 'A', riskTolerance: 'MODERATE' },
  { clientId: 'C2', firstName: 'Bob', lastName: 'B', riskTolerance: 'AGGRESSIVE' },
];

const goals = [
  { goalId: 'G1', clientId: 'C1' },
  { goalId: 'G2', clientId: 'C1' },
  { goalId: 'G3', clientId: 'C2' },
];

// Stub projector: G1 on track, G2 off track (with shortfall), G3 at risk.
const project = (goal) => {
  const map = {
    G1: { status: 'ON_TRACK', monthlyShortfall: 0 },
    G2: { status: 'OFF_TRACK', monthlyShortfall: 500 },
    G3: { status: 'AT_RISK', monthlyShortfall: 200 },
  };
  return map[goal.goalId];
};

const items = [
  { itemId: 'A1', clientId: 'C1', kind: 'ASSET', category: 'CASH', value: 100000 },
  { itemId: 'A2', clientId: 'C1', kind: 'ASSET', category: 'INVESTMENT', value: 400000 },
  { itemId: 'L1', clientId: 'C1', kind: 'LIABILITY', category: 'MORTGAGE', value: 200000 },
  { itemId: 'A3', clientId: 'C2', kind: 'ASSET', category: 'REAL_ESTATE', value: 600000 },
];

const plans = [
  { planId: 'P1', clientId: 'C1', status: 'ACTIVE' },
  { planId: 'P2', clientId: 'C2', status: 'DRAFT' },
];

test('buildPortfolioOverview aggregates counts and totals', () => {
  const o = buildPortfolioOverview({ clients, goals, items, plans, project });
  assert.equal(o.clientCount, 2);
  assert.equal(o.goalCount, 3);
  assert.equal(o.planCount, 2);
  assert.equal(o.totalAssets, 1100000);
  assert.equal(o.totalLiabilities, 200000);
  assert.equal(o.netWorth, 900000);
});

test('buildPortfolioOverview computes goal status mix and percentages', () => {
  const o = buildPortfolioOverview({ clients, goals, items, plans, project });
  assert.deepEqual(o.goalStatusMix, { ON_TRACK: 1, AT_RISK: 1, OFF_TRACK: 1 });
  assert.equal(o.goalStatusPct.ON_TRACK, round(1 / 3));
});

test('buildPortfolioOverview counts plan statuses', () => {
  const o = buildPortfolioOverview({ clients, goals, items, plans, project });
  assert.equal(o.planStatus.ACTIVE, 1);
  assert.equal(o.planStatus.DRAFT, 1);
  assert.equal(o.planStatus.ARCHIVED, 0);
});

test('buildPortfolioOverview flags clients needing attention, worst first', () => {
  const o = buildPortfolioOverview({ clients, goals, items, plans, project });
  // C1 has an off-track goal; C2 has an at-risk goal. Both need attention; C1 first.
  assert.equal(o.clientsNeedingAttentionCount, 2);
  assert.equal(o.clientsNeedingAttention[0].clientId, 'C1');
  assert.equal(o.clientsNeedingAttention[0].offTrack, 1);
  assert.equal(o.clientsNeedingAttention[0].totalMonthlyShortfall, 500);
  assert.equal(o.clientsNeedingAttention[0].name, 'Ann A');
});

test('buildPortfolioOverview omits fully on-track clients from attention list', () => {
  const allOnTrack = (g) => ({ status: 'ON_TRACK', monthlyShortfall: 0 });
  const o = buildPortfolioOverview({ clients, goals, items, plans, project: allOnTrack });
  assert.equal(o.clientsNeedingAttentionCount, 0);
  assert.deepEqual(o.clientsNeedingAttention, []);
});

function round(v) {
  return Math.round(v * 1000) / 1000;
}
