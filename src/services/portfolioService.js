/**
 * Book-of-business (portfolio-wide) aggregation.
 *
 * Rolls up every client, goal, asset/liability, and plan into a single
 * advisor "home" view: total AUM and net worth, the goal-status mix across the
 * whole book, plan status counts, and the clients most in need of attention.
 *
 * Pure: the caller passes the raw collections and a projector; this module
 * never touches the store. See the netWorth/projection engines it composes.
 */

import { computeNetWorth } from './netWorthService.js';

function round(value, dp = 2) {
  if (!Number.isFinite(value)) return 0;
  const f = Math.pow(10, dp);
  return Math.round(value * f) / f;
}

/**
 * Build the portfolio overview.
 *
 * @param {object} args
 * @param {Array<object>} args.clients all clients
 * @param {Array<object>} args.goals   all goals
 * @param {Array<object>} args.items   all assets/liabilities
 * @param {Array<object>} args.plans   all plans
 * @param {(goal:object, client:object)=>object} args.project projection fn
 * @returns {object} the aggregated overview
 */
export function buildPortfolioOverview({ clients, goals, items, plans, project }) {
  const clientById = new Map(clients.map((c) => [c.clientId, c]));

  // --- goals: status mix + per-client roll-up in one pass ---
  const statusMix = { ON_TRACK: 0, AT_RISK: 0, OFF_TRACK: 0 };
  const perClient = new Map(); // clientId -> { goals, onTrack, atRisk, offTrack, totalShortfall }
  for (const goal of goals) {
    const client = clientById.get(goal.clientId);
    const p = project(goal, client);
    statusMix[p.status] = (statusMix[p.status] || 0) + 1;

    const agg = perClient.get(goal.clientId) || {
      goals: 0, onTrack: 0, atRisk: 0, offTrack: 0, totalShortfall: 0,
    };
    agg.goals += 1;
    if (p.status === 'ON_TRACK') agg.onTrack += 1;
    else if (p.status === 'AT_RISK') agg.atRisk += 1;
    else agg.offTrack += 1;
    agg.totalShortfall += p.monthlyShortfall || 0;
    perClient.set(goal.clientId, agg);
  }

  // --- net worth across the book ---
  const itemsByClient = new Map();
  for (const item of items) {
    const list = itemsByClient.get(item.clientId) || [];
    list.push(item);
    itemsByClient.set(item.clientId, list);
  }
  let totalAssets = 0;
  let totalLiabilities = 0;
  for (const [clientId, list] of itemsByClient) {
    const nw = computeNetWorth(clientId, list);
    totalAssets += nw.totalAssets;
    totalLiabilities += nw.totalLiabilities;
  }

  // --- plan status counts ---
  const planStatus = { DRAFT: 0, ACTIVE: 0, ARCHIVED: 0 };
  for (const plan of plans) planStatus[plan.status] = (planStatus[plan.status] || 0) + 1;

  // --- clients needing attention: any off-track or at-risk goals, worst first ---
  const clientsNeedingAttention = [...perClient.entries()]
    .map(([clientId, agg]) => {
      const client = clientById.get(clientId);
      return {
        clientId,
        name: client ? `${client.firstName} ${client.lastName}` : clientId,
        riskTolerance: client?.riskTolerance,
        goalCount: agg.goals,
        onTrack: agg.onTrack,
        atRisk: agg.atRisk,
        offTrack: agg.offTrack,
        onTrackPercentage: agg.goals > 0 ? round(agg.onTrack / agg.goals, 2) : 0,
        totalMonthlyShortfall: round(agg.totalShortfall),
      };
    })
    .filter((c) => c.offTrack > 0 || c.atRisk > 0)
    .sort(
      (a, b) =>
        b.offTrack - a.offTrack ||
        b.atRisk - a.atRisk ||
        b.totalMonthlyShortfall - a.totalMonthlyShortfall,
    );

  const totalGoals = goals.length;

  return {
    clientCount: clients.length,
    goalCount: totalGoals,
    planCount: plans.length,
    totalAssets: round(totalAssets),
    totalLiabilities: round(totalLiabilities),
    netWorth: round(totalAssets - totalLiabilities),
    goalStatusMix: statusMix,
    goalStatusPct: {
      ON_TRACK: totalGoals ? round(statusMix.ON_TRACK / totalGoals, 3) : 0,
      AT_RISK: totalGoals ? round(statusMix.AT_RISK / totalGoals, 3) : 0,
      OFF_TRACK: totalGoals ? round(statusMix.OFF_TRACK / totalGoals, 3) : 0,
    },
    planStatus,
    clientsNeedingAttentionCount: clientsNeedingAttention.length,
    clientsNeedingAttention,
  };
}
