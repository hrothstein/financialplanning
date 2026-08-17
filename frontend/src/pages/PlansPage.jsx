import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox } from '../components.jsx';
import { fmtUSD, fmtPct } from '../format.js';

export default function PlansPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');

  const { data, error, loading } = useAsync(async () => {
    const params = new URLSearchParams({ limit: '500' });
    if (status) params.set('status', status);
    const resp = await api.listPlans(`?${params.toString()}`);
    // Enrich with the plan summary for overall funded % + status counts.
    const plans = await Promise.all(
      resp.items.map(async (p) => {
        try {
          const summary = await api.getPlanSummary(p.planId);
          return { ...p, summary };
        } catch {
          return { ...p, summary: null };
        }
      }),
    );
    return { total: resp.total, plans };
  }, [status]);

  return (
    <div>
      <h1>Plans</h1>
      <p className="subtle">Every financial plan across clients. Click a plan for its aggregate summary and Monte Carlo.</p>

      <div className="toolbar mt-16">
        <label className="subtle">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        {data && <span className="subtle">{data.plans.length} plans</span>}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Plan</th><th>Client</th><th>Status</th>
                <th className="num">Goals</th><th className="num">Funded</th><th>Attention</th>
              </tr>
            </thead>
            <tbody>
              {data.plans.map((p) => (
                <tr key={p.planId} className="clickable" onClick={() => navigate(`/plans/${p.planId}`)}>
                  <td><strong>{p.name}</strong> <span className="pill">{p.planId}</span></td>
                  <td><span className="pill">{p.clientId}</span></td>
                  <td><span className="pill">{p.status}</span></td>
                  <td className="num">{p.goalIds.length}</td>
                  <td className="num">{p.summary ? fmtPct(p.summary.overallFundedPercentage, 0) : '—'}</td>
                  <td className="subtle">
                    {p.summary
                      ? p.summary.goalsNeedingAttention.length > 0
                        ? `${p.summary.goalsNeedingAttention.length} goal(s), ${fmtUSD(p.summary.totalMonthlyShortfall)}/mo gap`
                        : 'All on track'
                      : '—'}
                  </td>
                </tr>
              ))}
              {data.plans.length === 0 && <tr><td colSpan={6} className="subtle">No plans match.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
