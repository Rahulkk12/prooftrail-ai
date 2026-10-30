import React, { useState } from 'react';
import {
  ArrowLeft,
  Share2,
  Download,
  Copy,
  Check,
  RotateCcw,
  Clock,
  Globe2,
  FileText,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ExternalLink,
  Layers,
  Sparkles,
  Info
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EvidenceCard from '../components/EvidenceCard';
import SourceCard from '../components/SourceCard';
import ConflictComparison from '../components/ConflictComparison';

export default function ReportPage({ report, onNavigate, onRetry, isRetrying = false }) {
  const [activeTab, setActiveTab] = useState('findings'); // 'findings', 'conflicts', 'sources', 'audit'
  const [expandedClaims, setExpandedClaims] = useState({});
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);

  if (!report) {
    return (
      <div className="report-not-found-card">
        <h3>Report Not Available</h3>
        <p>No active report was found. Please select a past investigation or start a new inquiry.</p>
        <button type="button" className="btn-primary" onClick={() => onNavigate('dashboard')}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const claimUnits = report.claim_units || [];
  const findings = report.findings || [];
  const sources = report.sources || [];
  const evidenceList = report.evidence || [];
  const limitations = report.limitations || [];
  const runLog = report.run_log || [];

  const evidenceMap = new Map();
  evidenceList.forEach((e) => evidenceMap.set(e.id, e));

  const sourceMap = new Map();
  sources.forEach((s) => sourceMap.set(s.id, s));

  // Count by status
  const counts = {
    SUPPORTED: findings.filter((f) => f.status === 'SUPPORTED').length,
    CONTRADICTED: findings.filter((f) => f.status === 'CONTRADICTED').length,
    MIXED: findings.filter((f) => f.status === 'MIXED').length,
    UNVERIFIED: findings.filter((f) => f.status === 'UNVERIFIED').length,
  };

  const toggleClaimExpand = (claimId) => {
    setExpandedClaims((prev) => ({
      ...prev,
      [claimId]: !prev[claimId],
    }));
  };

  const handleExportJson = () => {
    const jsonStr = JSON.stringify(report, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prooftrail-${report.investigation_id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopySummary = () => {
    const summaryText = `PROOFTRAIL AI INVESTIGATION REPORT
Claim: ${report.input_text}
Status: ${report.status}
Checked At: ${report.checked_at}
Supported Fields: ${counts.SUPPORTED}
Contradicted Fields: ${counts.CONTRADICTED}
Mixed Fields: ${counts.MIXED}
Unverified Fields: ${counts.UNVERIFIED}
Sources Analyzed: ${sources.length}
URL: ${window.location.href}`;

    navigator.clipboard.writeText(summaryText);
    setCopiedSummary(true);
    setTimeout(() => setCopiedSummary(false), 2000);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const checkedDate = report.checked_at ? new Date(report.checked_at).toLocaleString() : 'Recent';

  return (
    <div className="report-page-container">
      {/* Top Navigation & Action Bar */}
      <div className="report-action-bar">
        <button
          type="button"
          className="btn-back-nav"
          onClick={() => onNavigate('dashboard')}
        >
          <ArrowLeft size={14} />
          <span>Back to Dashboard</span>
        </button>

        <div className="report-top-actions">
          <button
            type="button"
            className="btn-action-outline"
            onClick={handleCopySummary}
            title="Copy plain-text summary"
          >
            {copiedSummary ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
            <span>{copiedSummary ? 'Copied' : 'Copy Summary'}</span>
          </button>

          <button
            type="button"
            className="btn-action-outline"
            onClick={handleExportJson}
            title="Download full JSON ledger"
          >
            <Download size={14} />
            <span>Export JSON</span>
          </button>

          {onRetry && (
            <button
              type="button"
              className="btn-action-outline"
              onClick={() => onRetry(report.investigation_id)}
              disabled={isRetrying}
              title="Rerun investigation against live web"
            >
              <RotateCcw size={14} className={isRetrying ? 'animate-spin' : ''} />
              <span>{isRetrying ? 'Rerunning...' : 'Rerun'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Report Header Card */}
      <div className="report-hero-card">
        {report.is_example && (
          <div className="report-demo-tag">
            <Sparkles size={13} />
            <span>DEMO BENCHMARK REPORT — Offline pre-computed evaluation</span>
          </div>
        )}

        <div className="report-meta-header">
          <div className="report-id-group">
            <span className="report-id-label">REPORT LEDGER</span>
            <span className="report-id-code">{report.investigation_id}</span>
          </div>
          <StatusBadge status={report.status} size="lg" />
        </div>

        <div className="report-claim-display">
          <span className="claim-sublabel">INVESTIGATED CLAIM</span>
          <h1 className="report-claim-title">“{report.input_text}”</h1>
          {report.input_url && (
            <div className="report-source-ref">
              <Globe2 size={13} />
              <span>Referenced Original URL:</span>
              <a href={report.input_url} target="_blank" rel="noopener noreferrer">
                {report.input_url} <ExternalLink size={11} />
              </a>
            </div>
          )}
        </div>

        <div className="report-quick-stats">
          <div className="quick-stat-item">
            <Clock size={14} />
            <span>Checked: {checkedDate}</span>
          </div>
          <div className="quick-stat-item">
            <Layers size={14} />
            <span>{claimUnits.length} Atomic Fields</span>
          </div>
          <div className="quick-stat-item">
            <Globe2 size={14} />
            <span>{sources.length} Web Sources Crawled</span>
          </div>
          <div className="quick-stat-item">
            <FileText size={14} />
            <span>{evidenceList.length} Exact Quotations</span>
          </div>
        </div>

        {/* 4-Status Pill Bar */}
        <div className="report-status-pills-row">
          <div className="status-kpi-pill kpi-supported">
            <span className="kpi-count">{counts.SUPPORTED}</span>
            <span className="kpi-label">Supported</span>
          </div>
          <div className="status-kpi-pill kpi-contradicted">
            <span className="kpi-count">{counts.CONTRADICTED}</span>
            <span className="kpi-label">Contradicted</span>
          </div>
          <div className="status-kpi-pill kpi-mixed">
            <span className="kpi-count">{counts.MIXED}</span>
            <span className="kpi-label">Mixed Evidence</span>
          </div>
          <div className="status-kpi-pill kpi-unverified">
            <span className="kpi-count">{counts.UNVERIFIED}</span>
            <span className="kpi-label">Unverified Gaps</span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="report-tabs-bar">
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'findings' ? 'active' : ''}`}
          onClick={() => setActiveTab('findings')}
        >
          <span>Claim Findings ({findings.length})</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'conflicts' ? 'active' : ''}`}
          onClick={() => setActiveTab('conflicts')}
        >
          <span>Conflict Analysis</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveTab('sources')}
        >
          <span>Sources & Provenance ({sources.length})</span>
        </button>
        <button
          type="button"
          className={`report-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          <span>Audit Ledger & Limitations</span>
        </button>
      </div>

      {/* Tab 1: Claim Findings */}
      {activeTab === 'findings' && (
        <div className="findings-tab-pane">
          {findings.map((finding, idx) => {
            const claim = claimUnits.find((c) => c.id === finding.claim_unit_id);
            const isExpanded = expandedClaims[finding.claim_unit_id] !== false; // expanded by default
            const evIds = finding.evidence_ids || [];

            return (
              <div key={finding.claim_unit_id} className="finding-card">
                <div
                  className="finding-card-header"
                  onClick={() => toggleClaimExpand(finding.claim_unit_id)}
                >
                  <div className="finding-header-left">
                    <span className="finding-index">0{idx + 1}</span>
                    <h3 className="finding-claim-text">{claim?.claim_text || 'Claim Field'}</h3>
                  </div>
                  <div className="finding-header-right">
                    <StatusBadge status={finding.status} />
                    <button type="button" className="expand-chevron-btn" aria-label="Toggle details">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="finding-card-body">
                    {/* Analytical Rationale */}
                    <div className="finding-rationale-box">
                      <span className="rationale-label">Analytical Evaluation:</span>
                      <p>{finding.rationale}</p>
                    </div>

                    {/* Cited Evidence Cards */}
                    <div className="finding-evidence-section">
                      <div className="evidence-section-label">
                        <span>Exact DOM Passages Cited ({evIds.length}):</span>
                      </div>

                      {evIds.length === 0 ? (
                        <div className="no-citations-notice">
                          <Info size={14} />
                          <span>
                            No exact source passage in public crawled pages corroborated or refuted this atomic fact.
                            ProofTrail policy strictly enforces UNVERIFIED rather than guessing.
                          </span>
                        </div>
                      ) : (
                        <div className="evidence-cards-list">
                          {evIds.map((id) => {
                            const ev = evidenceMap.get(id);
                            const src = sources.find((s) => (s.evidence || []).some((e) => e.id === id));
                            return <EvidenceCard key={id} evidence={ev} source={src} />;
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Conflict Analysis */}
      {activeTab === 'conflicts' && (
        <div className="conflicts-tab-pane">
          <ConflictComparison report={report} />
        </div>
      )}

      {/* Tab 3: Sources & Provenance */}
      {activeTab === 'sources' && (
        <div className="sources-tab-pane">
          <div className="sources-grid">
            {sources.length === 0 ? (
              <div className="empty-sources-banner">
                <Globe2 size={24} className="text-muted" />
                <p>No web sources were successfully retrieved for this investigation.</p>
              </div>
            ) : (
              sources.map((s) => <SourceCard key={s.id} source={s} />)
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Audit Ledger & Limitations */}
      {activeTab === 'audit' && (
        <div className="audit-tab-pane">
          {/* Methodology */}
          <div className="audit-card">
            <h4>Methodology & Verification Rules</h4>
            <p className="methodology-text">{report.methodology}</p>
            <span className="methodology-version">Version {report.methodology_version || '0.1.0'}</span>
          </div>

          {/* Limitations & Gaps */}
          <div className="audit-card">
            <h4>Encountered Limitations & Coverage Gaps</h4>
            {limitations.length === 0 ? (
              <p className="no-limitations-text">
                ✓ No critical coverage gaps or network failures were encountered during this run.
              </p>
            ) : (
              <ul className="limitations-list">
                {limitations.map((lim, i) => (
                  <li key={i}>
                    <AlertTriangle size={13} className="text-amber" />
                    <span>{lim}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Execution Trace */}
          <div className="audit-card">
            <h4>Pipeline Execution Trace</h4>
            <div className="trace-list">
              {runLog.map((step, i) => (
                <div key={i} className="trace-item">
                  <span className="trace-step-name">{step.step}</span>
                  <span className={`trace-status status-${step.status}`}>{step.status}</span>
                  <span className="trace-time">
                    {step.timestamp ? new Date(step.timestamp).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Disclaimer */}
      <div className="report-footer-disclaimer">
        <ShieldCheck size={16} className="text-accent" />
        <p>
          A ProofTrail status assesses retrieved web evidence and enforces verbatim DOM substrings.
          It is designed for evidence assistance and forensic verification, not absolute infallibility.
          Always open and review primary citations in their original domain context.
        </p>
      </div>
    </div>
  );
}
