/**
 * Unit tests for the net worth service (PRD §4.4).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { computeNetWorth } from '../src/services/netWorthService.js';

const items = [
  { itemId: 'ASSET-1', clientId: 'C1', kind: 'ASSET', category: 'CASH', value: 20000 },
  { itemId: 'ASSET-2', clientId: 'C1', kind: 'ASSET', category: 'INVESTMENT', value: 150000 },
  { itemId: 'ASSET-3', clientId: 'C1', kind: 'ASSET', category: 'INVESTMENT', value: 50000 },
  { itemId: 'ASSET-4', clientId: 'C1', kind: 'ASSET', category: 'REAL_ESTATE', value: 500000 },
  { itemId: 'LIAB-1', clientId: 'C1', kind: 'LIABILITY', category: 'MORTGAGE', value: 300000 },
  { itemId: 'LIAB-2', clientId: 'C1', kind: 'LIABILITY', category: 'CREDIT_CARD', value: 8000 },
];

test('computeNetWorth totals and net', () => {
  const nw = computeNetWorth('C1', items);
  assert.equal(nw.totalAssets, 720000);
  assert.equal(nw.totalLiabilities, 308000);
  assert.equal(nw.netWorth, 412000);
});

test('computeNetWorth groups by category and sorts descending', () => {
  const nw = computeNetWorth('C1', items);
  const investment = nw.assetBreakdown.find((b) => b.category === 'INVESTMENT');
  assert.equal(investment.total, 200000);
  assert.equal(investment.count, 2);
  // Sorted descending by total: REAL_ESTATE (500k) first.
  assert.equal(nw.assetBreakdown[0].category, 'REAL_ESTATE');
});

test('computeNetWorth handles empty item list', () => {
  const nw = computeNetWorth('C2', []);
  assert.equal(nw.totalAssets, 0);
  assert.equal(nw.totalLiabilities, 0);
  assert.equal(nw.netWorth, 0);
  assert.deepEqual(nw.assetBreakdown, []);
});

test('computeNetWorth handles assets-only (no liabilities)', () => {
  const nw = computeNetWorth('C3', [items[0], items[1]]);
  assert.equal(nw.totalLiabilities, 0);
  assert.equal(nw.netWorth, nw.totalAssets);
});
