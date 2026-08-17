import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from './api.js';
import OverviewPage from './pages/OverviewPage.jsx';
import ClientsPage from './pages/ClientsPage.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import GoalsPage from './pages/GoalsPage.jsx';
import GoalDetail from './pages/GoalDetail.jsx';
import PlansPage from './pages/PlansPage.jsx';
import PlanDetail from './pages/PlanDetail.jsx';

export default function App() {
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await api.reset();
      navigate('/');
      window.location.reload();
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">Financial<span>Planning</span></Link>
        <nav className="tabs">
          <NavLink to="/" end>Overview</NavLink>
          <NavLink to="/clients">Clients</NavLink>
          <NavLink to="/goals">Goals</NavLink>
          <NavLink to="/plans">Plans</NavLink>
        </nav>
        <div className="spacer" />
        <div className="links">
          <a href="/docs" target="_blank" rel="noreferrer">API docs</a>
          <a href="/mcp/tools" target="_blank" rel="noreferrer">MCP tools</a>
        </div>
        <button className="ghost" onClick={handleReset} disabled={resetting} style={{ marginLeft: 18 }}>
          {resetting ? 'Resetting…' : 'Reset demo data'}
        </button>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<OverviewPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:clientId" element={<ClientDashboard />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/goals/:goalId" element={<GoalDetail />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/:planId" element={<PlanDetail />} />
          <Route path="*" element={<div className="card">Not found. <Link to="/">Back to overview</Link></div>} />
        </Routes>
      </main>
    </div>
  );
}
