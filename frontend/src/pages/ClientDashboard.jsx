import { useParams, Link, useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox, Stat, FundedBar, StatusBadge } from '../components.jsx';
import { getComputedColor } from '../components.jsx';
import { fmtUSD, fmtPct, goalTypeLabel, categoryLabel, fundedColor } from '../format.js';

export default function ClientDashboard() {
  const { clientId } = useParams();
  const navigate = useNavigate();

  const { data, error, loading } = useAsync(async () => {
    // Load the client's summary, goals, plans, and net worth together, then
    // enrich each goal with its projection so we can show funded % + status.
    const [summary, goalsResp, plansResp, netWorth] = await Promise.all([
      api.getClientSummary(clientId),
      api.listGoals(`?clientId=${clientId}&limit=200`),
      api.listPlans(`?clientId=${clientId}`),
      api.getNetWorth(clientId),
    ]);
    const goals = await Promise.all(
      goalsResp.items.map(async (g) => ({ ...g, projection: await api.getProjection(g.goalId) })),
    );
    return { summary, goals, plans: plansResp.items, netWorth };
  }, [clientId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const { summary, goals, plans, netWorth } = data;
  const c = summary.client;

  const palette = ['--accent', '--ok', '--warn', '--accent-2', '--muted'].map((v) => getComputedColor(`var(${v})`));
  const nwData = {
    labels: netWorth.assetBreakdown.map((b) => categoryLabel(b.category)),
    datasets: [
      {
        data: netWorth.assetBreakdown.map((b) => b.total),
        backgroundColor: palette,
        borderColor: getComputedColor('var(--panel)'),
        borderWidth: 2,
      },
    ],
  };
  const nwOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: getComputedColor('var(--muted)'), boxWidth: 12, font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmtUSD(ctx.parsed)}` } },
    },
  };

  return (
    <div>
      <div className="crumbs">
        <Link to="/">Clients</Link><span className="sep">/</span>{c.firstName} {c.lastName}
      </div>

      <div className="row-between">
        <div>
          <h1 className="mb-0">{c.firstName} {c.lastName}</h1>
          <p className="subtle">{c.clientId} · Age {c.age} · Retires at {c.retirementAge} · {c.riskTolerance.toLowerCase()} risk</p>
        </div>
      </div>

      {/* Top stat row */}
      <div className="grid cols-4 mt-16">
        <Stat label="Net worth" value={fmtUSD(netWorth.netWorth)} sub={`${fmtUSD(netWorth.totalAssets)} assets · ${fmtUSD(netWorth.totalLiabilities)} debt`} />
        <Stat label="Goals" value={summary.goalCount} sub={`${summary.onTrackCount} on track`} />
        <Stat label="On-track rate" value={fmtPct(summary.onTrackPercentage, 0)} color={fundedColor(summary.onTrackPercentage)} />
        <Stat label="Annual income" value={fmtUSD(c.annualIncome)} />
      </div>

      <div className="grid cols-2 mt-16">
        {/* Goals list */}
        <div className="card">
          <h2>Goals</h2>
          <ul className="clean">
            {goals.map((g) => (
              <li key={g.goalId}>
                <div className="row-between">
                  <div>
                    <Link to={`/goals/${g.goalId}`}><strong>{g.name}</strong></Link>
                    <span className="pill" style={{ marginLeft: 8 }}>{goalTypeLabel(g.type)}</span>
                  </div>
                  <StatusBadge status={g.projection.status} />
                </div>
                <div className="row-between mt-8" style={{ fontSize: 13 }}>
                  <span className="subtle">Target {fmtUSD(g.projection.adjustedTargetAmount)}</span>
                  <span style={{ color: fundedColor(g.projection.fundedPercentage), fontWeight: 600 }}>
                    {fmtPct(g.projection.fundedPercentage, 0)} funded
                  </span>
                </div>
                <div className="mt-8"><FundedBar value={g.projection.fundedPercentage} /></div>
              </li>
            ))}
            {goals.length === 0 && <li className="subtle">No goals for this client.</li>}
          </ul>
        </div>

        {/* Net worth breakdown */}
        <div className="card">
          <h2>Net worth by asset category</h2>
          {netWorth.assetBreakdown.length > 0 ? (
            <div className="chart-wrap"><Doughnut data={nwData} options={nwOptions} /></div>
          ) : (
            <p className="subtle">No assets recorded.</p>
          )}
          {netWorth.liabilityBreakdown.length > 0 && (
            <div className="mt-16">
              <h2>Liabilities</h2>
              <table>
                <tbody>
                  {netWorth.liabilityBreakdown.map((b) => (
                    <tr key={b.category}>
                      <td>{categoryLabel(b.category)}</td>
                      <td className="num">{fmtUSD(b.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Plans */}
      {plans.length > 0 && (
        <div className="card mt-16">
          <h2>Plans</h2>
          <table>
            <thead>
              <tr><th>Plan</th><th>Status</th><th className="num">Goals</th><th>Assumptions</th></tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.planId}>
                  <td><strong>{p.name}</strong> <span className="pill">{p.planId}</span></td>
                  <td><span className="pill">{p.status}</span></td>
                  <td className="num">{p.goalIds.length}</td>
                  <td className="subtle">Inflation {fmtPct(p.assumptions.inflationRate, 1)} · SS {fmtUSD(p.assumptions.socialSecurityMonthly)}/mo · life exp {p.assumptions.lifeExpectancy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
