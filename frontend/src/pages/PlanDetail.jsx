import { useParams, Link } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox, Stat, StatusBadge, FundedBar, ProbabilityGauge } from '../components.jsx';
import { fmtUSD, fmtPct, goalTypeLabel, fundedColor } from '../format.js';

export default function PlanDetail() {
  const { planId } = useParams();
  const navigate = useNavigate();

  const { data, error, loading } = useAsync(async () => {
    const [plan, summary, monteCarlo] = await Promise.all([
      api.getPlan(planId),
      api.getPlanSummary(planId),
      api.getPlanMonteCarlo(planId, '?seed=42&iterations=1000'),
    ]);
    return { plan, summary, monteCarlo };
  }, [planId]);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const { plan, summary, monteCarlo } = data;

  return (
    <div>
      <div className="crumbs">
        <Link to="/plans">Plans</Link><span className="sep">/</span>
        <Link to={`/clients/${plan.clientId}`}>{plan.clientId}</Link><span className="sep">/</span>{plan.name}
      </div>

      <div className="row-between">
        <div>
          <h1 className="mb-0">{plan.name}</h1>
          <p className="subtle">{plan.planId} · {plan.status} · {summary.goalCount} goals</p>
        </div>
      </div>

      <div className="grid cols-4 mt-16">
        <Stat label="Overall funded" value={fmtPct(summary.overallFundedPercentage, 0)} color={fundedColor(summary.overallFundedPercentage)} />
        <Stat label="Total target" value={fmtUSD(summary.totalTargetAmount)} />
        <Stat label="Total projected" value={fmtUSD(summary.totalProjectedAmount)} />
        <Stat label="Monthly gap" value={fmtUSD(summary.totalMonthlyShortfall)} color={summary.totalMonthlyShortfall > 0 ? 'var(--bad)' : 'var(--ok)'} />
      </div>

      <div className="grid cols-2 mt-16">
        <div className="card">
          <h2>Plan-wide Monte Carlo</h2>
          <ProbabilityGauge probability={monteCarlo.blendedProbabilityOfSuccess} caption="Blended probability" />
          <p className="subtle" style={{ textAlign: 'center' }}>
            Blended across {monteCarlo.goalCount} goals · {monteCarlo.iterations.toLocaleString()} sims · seed {monteCarlo.seed}
          </p>
          <div className="grid cols-3 mt-8" style={{ textAlign: 'center' }}>
            <div><div className="subtle">On track</div><strong style={{ color: 'var(--ok)' }}>{summary.statusCounts.ON_TRACK}</strong></div>
            <div><div className="subtle">At risk</div><strong style={{ color: 'var(--warn)' }}>{summary.statusCounts.AT_RISK}</strong></div>
            <div><div className="subtle">Off track</div><strong style={{ color: 'var(--bad)' }}>{summary.statusCounts.OFF_TRACK}</strong></div>
          </div>
        </div>

        <div className="card">
          <h2>Goals needing attention</h2>
          {summary.goalsNeedingAttention.length === 0 ? (
            <p className="subtle">All goals in this plan are on track. 🎉</p>
          ) : (
            <ul className="clean">
              {summary.goalsNeedingAttention.map((g) => (
                <li key={g.goalId}>
                  <div className="row-between">
                    <Link to={`/goals/${g.goalId}`}><strong>{g.name}</strong></Link>
                    <StatusBadge status={g.status} />
                  </div>
                  <div className="subtle mt-8" style={{ fontSize: 13 }}>
                    {fmtPct(g.fundedPercentage, 0)} funded · needs {fmtUSD(g.requiredMonthlyContribution)}/mo
                    (+{fmtUSD(g.monthlyShortfall)})
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card mt-16">
        <h2>All goals in this plan</h2>
        <table>
          <thead>
            <tr><th>Goal</th><th>Type</th><th className="num">Target</th><th style={{ width: 160 }}>Funded</th>
              <th className="num">MC success</th><th>Status</th></tr>
          </thead>
          <tbody>
            {summary.goals.map((g) => {
              const mc = monteCarlo.goals.find((m) => m.goalId === g.goalId);
              return (
                <tr key={g.goalId} className="clickable" onClick={() => navigate(`/goals/${g.goalId}`)}>
                  <td><strong>{g.name}</strong></td>
                  <td>{goalTypeLabel(g.type)}</td>
                  <td className="num">{fmtUSD(g.adjustedTargetAmount)}</td>
                  <td>
                    <div style={{ fontSize: 12, color: fundedColor(g.fundedPercentage), marginBottom: 4 }}>{fmtPct(g.fundedPercentage, 0)}</div>
                    <FundedBar value={g.fundedPercentage} />
                  </td>
                  <td className="num">{mc ? fmtPct(mc.probabilityOfSuccess, 0) : '—'}</td>
                  <td><StatusBadge status={g.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
