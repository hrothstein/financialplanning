import { useNavigate } from 'react-router-dom';
import { Doughnut } from 'react-chartjs-2';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox, Stat, getComputedColor } from '../components.jsx';
import { fmtUSD, fmtPct, fundedColor } from '../format.js';

export default function OverviewPage() {
  const navigate = useNavigate();
  const { data, error, loading } = useAsync(() => api.getPortfolioOverview(), []);

  if (loading) return <Loading />;
  if (error) return <ErrorBox error={error} />;

  const o = data;
  const mixData = {
    labels: ['On track', 'At risk', 'Off track'],
    datasets: [
      {
        data: [o.goalStatusMix.ON_TRACK, o.goalStatusMix.AT_RISK, o.goalStatusMix.OFF_TRACK],
        backgroundColor: [getComputedColor('var(--ok)'), getComputedColor('var(--warn)'), getComputedColor('var(--bad)')],
        borderColor: getComputedColor('var(--panel)'),
        borderWidth: 2,
      },
    ],
  };
  const mixOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'right', labels: { color: getComputedColor('var(--muted)'), boxWidth: 12, font: { size: 12 } } },
      tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed} goals` } },
    },
  };

  return (
    <div>
      <h1>Portfolio overview</h1>
      <p className="subtle">Book-of-business snapshot across all clients, goals, and plans.</p>

      <div className="grid cols-4 mt-16">
        <Stat label="Total net worth" value={fmtUSD(o.netWorth)} sub={`${fmtUSD(o.totalAssets)} assets · ${fmtUSD(o.totalLiabilities)} debt`} />
        <Stat label="Clients" value={o.clientCount} sub={`${o.clientsNeedingAttentionCount} need attention`} />
        <Stat label="Goals" value={o.goalCount} sub={`${o.goalStatusMix.ON_TRACK} on track`} />
        <Stat label="Plans" value={o.planCount} sub={`${o.planStatus.ACTIVE} active · ${o.planStatus.DRAFT} draft`} />
      </div>

      <div className="grid cols-2 mt-16">
        <div className="card">
          <h2>Goal status mix</h2>
          <div className="chart-wrap"><Doughnut data={mixData} options={mixOptions} /></div>
          <div className="grid cols-3 mt-16" style={{ textAlign: 'center' }}>
            <div><div className="subtle">On track</div><strong style={{ color: 'var(--ok)' }}>{fmtPct(o.goalStatusPct.ON_TRACK, 0)}</strong></div>
            <div><div className="subtle">At risk</div><strong style={{ color: 'var(--warn)' }}>{fmtPct(o.goalStatusPct.AT_RISK, 0)}</strong></div>
            <div><div className="subtle">Off track</div><strong style={{ color: 'var(--bad)' }}>{fmtPct(o.goalStatusPct.OFF_TRACK, 0)}</strong></div>
          </div>
        </div>

        <div className="card">
          <div className="row-between">
            <h2 className="mb-0">Clients needing attention</h2>
            <span className="pill">{o.clientsNeedingAttentionCount}</span>
          </div>
          <p className="subtle mt-8">Clients with at least one at-risk or off-track goal, worst first.</p>
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table>
              <thead>
                <tr><th>Client</th><th className="num">On track</th><th className="num">Gap / mo</th></tr>
              </thead>
              <tbody>
                {o.clientsNeedingAttention.slice(0, 12).map((c) => (
                  <tr key={c.clientId} className="clickable" onClick={() => navigate(`/clients/${c.clientId}`)}>
                    <td><strong>{c.name}</strong> <span className="pill">{c.clientId}</span></td>
                    <td className="num" style={{ color: fundedColor(c.onTrackPercentage) }}>{c.onTrack}/{c.goalCount}</td>
                    <td className="num">{fmtUSD(c.totalMonthlyShortfall)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
