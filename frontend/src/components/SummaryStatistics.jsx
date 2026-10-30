import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Activity, Globe2, ShieldCheck } from 'lucide-react';

export default function SummaryStatistics({ investigations = [], isDemo = false }) {
  // Aggregate stats across all investigations
  let totalInvestigations = investigations.length;
  let supported = 0;
  let contradicted = 0;
  let mixed = 0;
  let unverified = 0;
  let totalSources = 0;

  investigations.forEach((inv) => {
    totalSources += inv.sources_count || 0;
    if (inv.status_counts) {
      supported += inv.status_counts.SUPPORTED || 0;
      contradicted += inv.status_counts.CONTRADICTED || 0;
      mixed += inv.status_counts.MIXED || 0;
      unverified += inv.status_counts.UNVERIFIED || 0;
    }
  });

  const totalFindings = supported + contradicted + mixed + unverified;
  const verifiedFindings = supported + contradicted + mixed;
  const verificationRate = totalFindings > 0 ? Math.round((verifiedFindings / totalFindings) * 100) : 0;

  const pct = (val) => (totalFindings > 0 ? ((val / totalFindings) * 100).toFixed(1) : '0.0');

  return (
    <div className="summary-statistics-panel">
      {isDemo && (
        <div className="demo-data-banner">
          <ShieldCheck size={14} />
          <span>Demo Benchmark Statistics — Aggregated from validated case investigations</span>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Investigations</span>
            <Activity size={16} className="text-muted" />
          </div>
          <div className="kpi-body">
            <span className="kpi-value">{totalInvestigations}</span>
            <span className="kpi-subtext">{totalSources} web sources analyzed</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-supported">
          <div className="kpi-header">
            <span className="kpi-title">Supported Claims</span>
            <CheckCircle2 size={16} className="text-emerald" />
          </div>
          <div className="kpi-body">
            <span className="kpi-value text-emerald">{supported}</span>
            <span className="kpi-subtext">{pct(supported)}% of verified fields</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-contradicted">
          <div className="kpi-header">
            <span className="kpi-title">Contradicted Claims</span>
            <XCircle size={16} className="text-rose" />
          </div>
          <div className="kpi-body">
            <span className="kpi-value text-rose">{contradicted}</span>
            <span className="kpi-subtext">{pct(contradicted)}% debunked / refuted</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-mixed">
          <div className="kpi-header">
            <span className="kpi-title">Mixed Evidence</span>
            <AlertTriangle size={16} className="text-amber" />
          </div>
          <div className="kpi-body">
            <span className="kpi-value text-amber">{mixed}</span>
            <span className="kpi-subtext">{pct(mixed)}% conflicting data</span>
          </div>
        </div>

        <div className="kpi-card kpi-card-unverified">
          <div className="kpi-header">
            <span className="kpi-title">Unverified / Gaps</span>
            <HelpCircle size={16} className="text-muted" />
          </div>
          <div className="kpi-body">
            <span className="kpi-value text-muted">{unverified}</span>
            <span className="kpi-subtext">{pct(unverified)}% no proof found</span>
          </div>
        </div>
      </div>

      {/* Visual Distribution Bar */}
      {totalFindings > 0 && (
        <div className="evidence-ratio-card">
          <div className="ratio-header">
            <span className="ratio-title">Evidence Distribution Profile</span>
            <span className="ratio-rate">
              Verification Rigor Rate: <strong>{verificationRate}%</strong>
            </span>
          </div>

          <div className="ratio-bar-track">
            {supported > 0 && (
              <div
                className="ratio-segment segment-supported"
                style={{ width: `${(supported / totalFindings) * 100}%` }}
                title={`Supported: ${supported} (${pct(supported)}%)`}
              />
            )}
            {contradicted > 0 && (
              <div
                className="ratio-segment segment-contradicted"
                style={{ width: `${(contradicted / totalFindings) * 100}%` }}
                title={`Contradicted: ${contradicted} (${pct(contradicted)}%)`}
              />
            )}
            {mixed > 0 && (
              <div
                className="ratio-segment segment-mixed"
                style={{ width: `${(mixed / totalFindings) * 100}%` }}
                title={`Mixed: ${mixed} (${pct(mixed)}%)`}
              />
            )}
            {unverified > 0 && (
              <div
                className="ratio-segment segment-unverified"
                style={{ width: `${(unverified / totalFindings) * 100}%` }}
                title={`Unverified: ${unverified} (${pct(unverified)}%)`}
              />
            )}
          </div>

          <div className="ratio-legend">
            <span className="legend-item">
              <span className="legend-dot dot-supported" />
              Supported ({pct(supported)}%)
            </span>
            <span className="legend-item">
              <span className="legend-dot dot-contradicted" />
              Contradicted ({pct(contradicted)}%)
            </span>
            <span className="legend-item">
              <span className="legend-dot dot-mixed" />
              Mixed ({pct(mixed)}%)
            </span>
            <span className="legend-item">
              <span className="legend-dot dot-unverified" />
              Unverified ({pct(unverified)}%)
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
