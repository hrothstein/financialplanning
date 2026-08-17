/**
 * Net worth aggregation (PRD §4.4). Pure functions over a client's
 * asset/liability items.
 *
 * Items carry a positive `value`; a LIABILITY's value represents the balance
 * owed. Net worth = total assets − total liabilities.
 */

function round(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Group a list of items by category, summing their values.
 * @returns {Array<{category, total, count}>} sorted by descending total
 */
function breakdownByCategory(items) {
  const byCategory = new Map();
  for (const item of items) {
    const entry = byCategory.get(item.category) ?? { category: item.category, total: 0, count: 0 };
    entry.total += item.value;
    entry.count += 1;
    byCategory.set(item.category, entry);
  }
  return [...byCategory.values()]
    .map((e) => ({ ...e, total: round(e.total) }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Compute a client's net worth with category breakdowns.
 * @param {string} clientId
 * @param {Array<object>} items all asset/liability items for the client
 */
export function computeNetWorth(clientId, items) {
  const assets = items.filter((i) => i.kind === 'ASSET');
  const liabilities = items.filter((i) => i.kind === 'LIABILITY');

  const totalAssets = assets.reduce((sum, a) => sum + a.value, 0);
  const totalLiabilities = liabilities.reduce((sum, l) => sum + l.value, 0);

  return {
    clientId,
    totalAssets: round(totalAssets),
    totalLiabilities: round(totalLiabilities),
    netWorth: round(totalAssets - totalLiabilities),
    assetBreakdown: breakdownByCategory(assets),
    liabilityBreakdown: breakdownByCategory(liabilities),
    counts: {
      assets: assets.length,
      liabilities: liabilities.length,
    },
  };
}
