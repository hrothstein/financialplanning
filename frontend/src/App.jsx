import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { api } from './api.js';
import ClientsPage from './pages/ClientsPage.jsx';
import ClientDashboard from './pages/ClientDashboard.jsx';
import GoalDetail from './pages/GoalDetail.jsx';

export default function App() {
  const navigate = useNavigate();
  const [resetting, setResetting] = useState(false);

  async function handleReset() {
    setResetting(true);
    try {
      await api.reset();
      // Bounce to the client list so the refreshed data is obvious.
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
        <div className="spacer" />
        <div className="links">
          <Link to="/">Clients</Link>
          <a href="/docs" target="_blank" rel="noreferrer">API docs</a>
          <a href="/mcp/tools" target="_blank" rel="noreferrer">MCP tools</a>
        </div>
        <button className="ghost" onClick={handleReset} disabled={resetting} style={{ marginLeft: 18 }}>
          {resetting ? 'Resetting…' : 'Reset demo data'}
        </button>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<ClientsPage />} />
          <Route path="/clients/:clientId" element={<ClientDashboard />} />
          <Route path="/goals/:goalId" element={<GoalDetail />} />
          <Route path="*" element={<div className="card">Not found. <Link to="/">Back to clients</Link></div>} />
        </Routes>
      </main>
    </div>
  );
}
