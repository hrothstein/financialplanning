import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox, Stat, FundedBar, StatusBadge, ProbabilityGauge, getComputedColor } from '../components.jsx';
import { fmtUSD, fmtPct, goalTypeLabel, fundedColor } from '../format.js';

export default function GoalDetail() {
  const { goalId } = useParams();
  const [seed, setSeed] = useState(42);
  const [iterations, setIterations] = useState(1000);
  // A nonce bumped by "Re-run" so the Monte Carlo re-fetches with the same inputs.
  const [runNonce, setRunNonce] = useState(0);

  const base = useAsync(async () => {
    const [goal, projection] = await Promise.all([api.getGoal(goalId), api.getProjection(goalId)]);
    return { goal, projection };
  }, [goalId]);

  const mc = useAsync(
    () => api.getMonteCarlo(goalId, `?seed=${seed}&iterations=${iterations}`),
    [goalId, seed, iterations, runNonce],
  );

  if (base.loading) return <Loading />;
  if (base.error) return <ErrorBox error={base.error} />;

  const { goal, projection } = base.data;

  const barColor = getComputedColor('var(--accent)');
  const targetColor = getComputedColor('var(--warn)');
  const percentileChart = mc.data && {
    labels: ['p10', 'p25', 'p50', 'p75', 'p90'],
    datasets: [
      {
        label: 'Projected ending balance',
        data: [mc.data.percentiles.p10, mc.data.percentiles.p25, mc.data.percentiles.p50, mc.data.percentiles.p75, mc.data.percentiles.p90],
        backgroundColor: barColor,
        borderRadius: 6,
      },
    ],
  };
  const chartOptions = mc.data && {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: (ctx) => fmtUSD(ctx.parsed.y) } },
      annotationNote: false,
    },
    scales: {
      x: { ticks: { color: getComputedColor('var(--muted)') }, grid: { display: false } },
      y: {
        ticks: { color: getComputedColor('var(--muted)'), callback: (v) => `$${(v / 1000).toFixed(0)}k` },
        grid: { color: getComputedColor('var(--border)') },
      },
    },
  };

  return (
    <div>
      <div className="crumbs">
        <Link to="/">Clients</Link><span className="sep">/</span>
        <Link to={`/clients/${goal.clientId}`}>{goal.clientId}</Link><span className="sep">/</span>{goal.name}
      </div>

      <div className="row-between">
        <div>
          <h1 className="mb-0">{goal.name}</h1>
          <p className="subtle">{goalTypeLabel(goal.type)} · Target date {goal.targetDate} · {projection.yearsToTarget} years out</p>
        </div>
        <StatusBadge status={projection.status} />
      </div>

      {/* Projection stats */}
      <div className="grid cols-4 mt-16">
        <Stat label="Target (future $)" value={fmtUSD(projection.adjustedTargetAmount)} sub={goal.inTodaysDollars ? `${fmtUSD(projection.targetAmount)} in today's $` : 'stated in future $'} />
        <Stat label="Projected" value={fmtUSD(projection.projectedAmount)} color={fundedColor(projection.fundedPercentage)} />
        <Stat label="Funded" value={fmtPct(projection.fundedPercentage, 0)} color={fundedColor(projection.fundedPercentage)} />
        <Stat label="Expected return" value={fmtPct(projection.assumptions.expectedReturnRate, 1)} sub={`inflation ${fmtPct(projection.assumptions.inflationRate, 1)}`} />
      </div>

      <div className="card mt-16">
        <div className="row-between">
          <h2 className="mb-0">Funding progress</h2>
          <span style={{ color: fundedColor(projection.fundedPercentage), fontWeight: 700 }}>{fmtPct(projection.fundedPercentage, 1)}</span>
        </div>
        <div className="mt-8"><FundedBar value={projection.fundedPercentage} /></div>
        <div className="grid cols-3 mt-16">
          <div><div className="subtle">Current contribution</div><strong>{fmtUSD(projection.currentMonthlyContribution)}/mo</strong></div>
          <div><div className="subtle">Required to fully fund</div><strong>{fmtUSD(projection.requiredMonthlyContribution)}/mo</strong></div>
          <div><div className="subtle">Monthly shortfall</div><strong style={{ color: projection.monthlyShortfall > 0 ? 'var(--bad)' : 'var(--ok)' }}>{fmtUSD(projection.monthlyShortfall)}/mo</strong></div>
        </div>
      </div>

      {/* Monte Carlo */}
      <div className="grid cols-2 mt-16">
        <div className="card">
          <h2>Monte Carlo outlook</h2>
          {mc.loading && <Loading label="Simulating…" />}
          {mc.error && <ErrorBox error={mc.error} />}
          {mc.data && !mc.loading && (
            <>
              <ProbabilityGauge probability={mc.data.probabilityOfSuccess} />
              <p className="subtle" style={{ textAlign: 'center' }}>
                {mc.data.iterations.toLocaleString()} simulations · seed {mc.data.seed} · target {fmtUSD(mc.data.targetAmount)}
              </p>
            </>
          )}
          <div className="toolbar mt-16">
            <label className="subtle">Iterations</label>
            <select value={iterations} onChange={(e) => setIterations(Number(e.target.value))}>
              <option value={500}>500</option>
              <option value={1000}>1,000</option>
              <option value={5000}>5,000</option>
              <option value={10000}>10,000</option>
            </select>
            <label className="subtle">Seed</label>
            <input type="number" value={seed} style={{ width: 90 }} onChange={(e) => setSeed(Number(e.target.value))} />
            <button onClick={() => setRunNonce((n) => n + 1)}>Re-run</button>
          </div>
        </div>

        <div className="card">
          <h2>Range of outcomes</h2>
          {mc.data && !mc.loading ? (
            <>
              <div className="chart-wrap"><Bar data={percentileChart} options={chartOptions} /></div>
              <p className="subtle mt-8">Percentile ending balances. The p50 (median) is the middle outcome; p10 and p90 bound the likely range.</p>
            </>
          ) : (
            <Loading label="Simulating…" />
          )}
        </div>
      </div>
    </div>
  );
}
