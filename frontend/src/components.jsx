/** Small shared presentational components. */

import { Doughnut } from 'react-chartjs-2';
import { Chart, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { fmtPct, statusMeta, fundedColor } from './format.js';

// Register the Chart.js pieces we use (tree-shaken build requires this).
Chart.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="center">
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 12px' }} />
        {label}
      </div>
    </div>
  );
}

export function ErrorBox({ error }) {
  return <div className="error">{error?.message || String(error)}</div>;
}

export function StatusBadge({ status }) {
  const m = statusMeta(status);
  return (
    <span className="badge" style={{ color: m.color, background: m.bg }}>
      <span className="dot" />
      {m.label}
    </span>
  );
}

/** Horizontal funded-percentage bar, capped visually at 100%. */
export function FundedBar({ value }) {
  const pct = Math.max(0, Math.min(1, value || 0));
  return (
    <div className="bar" title={fmtPct(value, 1)}>
      <span style={{ width: `${pct * 100}%`, background: fundedColor(value) }} />
    </div>
  );
}

export function Stat({ label, value, sub, color }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value" style={color ? { color } : undefined}>{value}</div>
      {sub != null && <div className="subtle mt-8">{sub}</div>}
    </div>
  );
}

/**
 * Probability-of-success gauge (a half-doughnut) with the percentage in the
 * center. Green/amber/red by the same thresholds as goal status.
 */
export function ProbabilityGauge({ probability, caption = 'Probability of success' }) {
  const p = Math.max(0, Math.min(1, probability || 0));
  const color = p >= 0.7 ? 'var(--ok)' : p >= 0.5 ? 'var(--warn)' : 'var(--bad)';
  const resolved = getComputedColor(color);
  const data = {
    labels: ['Success', 'Shortfall'],
    datasets: [
      {
        data: [p, 1 - p],
        backgroundColor: [resolved, 'rgba(255,255,255,0.08)'],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
        cutout: '72%',
      },
    ],
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
  };
  return (
    <div className="gauge-wrap">
      <Doughnut data={data} options={options} />
      <div className="gauge-center" style={{ transform: 'translateY(18px)' }}>
        <div className="big" style={{ color }}>{fmtPct(p, 0)}</div>
        <div className="cap">{caption}</div>
      </div>
    </div>
  );
}

/** Resolve a CSS var() to a concrete color for Chart.js (which can't read vars). */
function getComputedColor(cssVar) {
  const match = /var\((--[\w-]+)\)/.exec(cssVar);
  if (!match) return cssVar;
  const val = getComputedStyle(document.documentElement).getPropertyValue(match[1]).trim();
  return val || '#4f8cff';
}

export { getComputedColor };
