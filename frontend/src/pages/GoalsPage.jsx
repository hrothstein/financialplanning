import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox, StatusBadge, FundedBar } from '../components.jsx';
import { fmtUSD, fmtPct, goalTypeLabel, fundedColor } from '../format.js';

const GOAL_TYPES = ['RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'MAJOR_PURCHASE', 'EMERGENCY_FUND', 'WEALTH_ACCUMULATION', 'LEGACY'];

export default function GoalsPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [type, setType] = useState('');
  const [priority, setPriority] = useState('');

  const { data, error, loading } = useAsync(async () => {
    const params = new URLSearchParams({ limit: '500' });
    if (status) params.set('status', status);
    if (type) params.set('type', type);
    if (priority) params.set('priority', priority);
    const resp = await api.listGoals(`?${params.toString()}`);
    // Enrich with projection so we can show funded % and target consistently.
    const goals = await Promise.all(
      resp.items.map(async (g) => ({ ...g, projection: await api.getProjection(g.goalId) })),
    );
    return { total: resp.total, goals };
  }, [status, type, priority]);

  return (
    <div>
      <h1>Goals</h1>
      <p className="subtle">Every goal across the book of business. Filter and click through to a goal's projection and Monte Carlo.</p>

      <div className="toolbar mt-16">
        <label className="subtle">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>
          <option value="ON_TRACK">On track</option>
          <option value="AT_RISK">At risk</option>
          <option value="OFF_TRACK">Off track</option>
        </select>
        <label className="subtle">Type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All</option>
          {GOAL_TYPES.map((t) => <option key={t} value={t}>{goalTypeLabel(t)}</option>)}
        </select>
        <label className="subtle">Priority</label>
        <select value={priority} onChange={(e) => setPriority(e.target.value)}>
          <option value="">All</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        {data && <span className="subtle">{data.goals.length} goals</span>}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Goal</th><th>Client</th><th>Type</th><th>Priority</th>
                <th className="num">Target</th><th style={{ width: 160 }}>Funded</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.goals.map((g) => (
                <tr key={g.goalId} className="clickable" onClick={() => navigate(`/goals/${g.goalId}`)}>
                  <td><strong>{g.name}</strong></td>
                  <td><span className="pill">{g.clientId}</span></td>
                  <td>{goalTypeLabel(g.type)}</td>
                  <td>{g.priority.charAt(0) + g.priority.slice(1).toLowerCase()}</td>
                  <td className="num">{fmtUSD(g.projection.adjustedTargetAmount)}</td>
                  <td>
                    <div className="row-between" style={{ fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: fundedColor(g.projection.fundedPercentage) }}>{fmtPct(g.projection.fundedPercentage, 0)}</span>
                    </div>
                    <FundedBar value={g.projection.fundedPercentage} />
                  </td>
                  <td><StatusBadge status={g.projection.status} /></td>
                </tr>
              ))}
              {data.goals.length === 0 && <tr><td colSpan={7} className="subtle">No goals match those filters.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
