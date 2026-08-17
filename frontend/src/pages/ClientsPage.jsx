import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import { useAsync } from '../useAsync.js';
import { Loading, ErrorBox } from '../components.jsx';
import { fmtUSD } from '../format.js';

export default function ClientsPage() {
  const navigate = useNavigate();
  const [risk, setRisk] = useState('');

  const query = risk ? `?riskTolerance=${risk}&limit=200` : '?limit=200';
  const { data, error, loading } = useAsync(() => api.listClients(query), [risk]);

  return (
    <div>
      <h1>Clients</h1>
      <p className="subtle">Goals-based financial planning across the book of business. Select a client to open their plan dashboard.</p>

      <div className="toolbar mt-16">
        <label className="subtle">Risk tolerance</label>
        <select value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="">All</option>
          <option value="CONSERVATIVE">Conservative</option>
          <option value="MODERATE">Moderate</option>
          <option value="AGGRESSIVE">Aggressive</option>
        </select>
        {data && <span className="subtle">{data.total} clients</span>}
      </div>

      {loading && <Loading />}
      {error && <ErrorBox error={error} />}
      {data && (
        <div className="grid cols-3">
          {data.items.map((c) => (
            <div key={c.clientId} className="card link" onClick={() => navigate(`/clients/${c.clientId}`)}>
              <div className="row-between">
                <strong>{c.firstName} {c.lastName}</strong>
                <span className="pill">{c.clientId}</span>
              </div>
              <div className="subtle mt-8">Age {c.age} · Retires {c.retirementAge}</div>
              <div className="subtle">{c.riskTolerance.charAt(0) + c.riskTolerance.slice(1).toLowerCase()} · {c.filingStatus.replace(/_/g, ' ').toLowerCase()}</div>
              <div className="mt-8" style={{ fontWeight: 600 }}>{fmtUSD(c.annualIncome)} <span className="subtle" style={{ fontWeight: 400 }}>income</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
