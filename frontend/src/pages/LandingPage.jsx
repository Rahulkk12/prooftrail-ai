import React, { useState } from 'react';
import {
  Fingerprint,
  ShieldCheck,
  Search,
  Globe2,
  LockKeyhole,
  FileSearch,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  ArrowRight,
  ArrowUpRight,
  Sparkles,
  Layers,
  Terminal,
  Activity,
  Cpu,
  BarChart3,
  ExternalLink
} from 'lucide-react';
import InvestigationForm from '../components/InvestigationForm';
import StatusBadge from '../components/StatusBadge';
import EvidenceCard from '../components/EvidenceCard';
import { EXAMPLE_INVESTIGATION_REPORTS } from '../data/exampleReports';

export default function LandingPage({ onNavigate, onStartInvestigation, onLoadExample }) {
  const [selectedExampleIndex, setSelectedExampleIndex] = useState(0);
  const activeExample = EXAMPLE_INVESTIGATION_REPORTS[selectedExampleIndex] || EXAMPLE_INVESTIGATION_REPORTS[0];

  const handleFormSubmit = ({ claim, sourceUrl }) => {
    onStartInvestigation(claim, sourceUrl);
  };

  return (
    <div className="landing-page-root">
      {/* Hero Section */}
      <section className="landing-hero-section">
        <div className="hero-glow-sphere" />
        <div className="hero-container">
          <div className="hero-badge-pill">
            <span className="hero-badge-pulse" />
            <Fingerprint size={13} className="text-accent" />
            <span>TINYFISH-POWERED INVESTIGATION ENGINE</span>
          </div>

          <h1 className="hero-headline">
            Evidence, <em>not</em> assumptions.
          </h1>

          <p className="hero-subheading">
            Autonomous web investigation platform that dismantles dubious claims, crawls the live web with
            TinyFish, and enforces exact-substring citations. Zero hallucinated verdicts.
          </p>

          {/* Quick Investigation Form in Hero */}
          <div className="hero-form-container">
            <InvestigationForm onSubmit={handleFormSubmit} />
          </div>

          {/* Hero Value Props */}
          <div className="hero-proof-bar">
            <div className="proof-point">
              <ShieldCheck size={16} className="text-emerald" />
              <span>Verbatim DOM Quotations</span>
            </div>
            <div className="proof-point">
              <Globe2 size={16} className="text-accent" />
              <span>Live Web Discovery via TinyFish</span>
            </div>
            <div className="proof-point">
              <LockKeyhole size={16} className="text-amber" />
              <span>Downgrades Unbacked Claims</span>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works-section" id="how-it-works">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-tag">AUDITABLE WORKFLOW</span>
            <h2>How ProofTrail Dissects The Web</h2>
            <p>
              Unlike standard AI chatbots that generate unchecked summaries, ProofTrail executes a
              multi-stage forensic evidence pipeline.
            </p>
          </div>

          <div className="workflow-cards-grid">
            <div className="workflow-card">
              <div className="step-number">01</div>
              <div className="workflow-card-icon">
                <FileSearch size={22} className="text-accent" />
              </div>
              <h3>Atomic Decomposition</h3>
              <p>
                Complex, compound claims are split into discrete, independently verifiable facts (entity, metric,
                date, location). If one part is false, the whole claim is not falsely validated.
              </p>
            </div>

            <div className="workflow-card">
              <div className="step-number">02</div>
              <div className="workflow-card-icon">
                <Search size={22} className="text-accent" />
              </div>
              <h3>TinyFish Web Discovery</h3>
              <p>
                Dynamic queries are dispatched to TinyFish Search to pinpoint original source URLs, official
                gazettes, university portals, and primary regulatory filings.
              </p>
            </div>

            <div className="workflow-card">
              <div className="step-number">03</div>
              <div className="workflow-card-icon">
                <Globe2 size={22} className="text-accent" />
              </div>
              <h3>DOM Extraction & Anti-SSRF</h3>
              <p>
                Candidate pages are retrieved into clean markdown DOMs via TinyFish Fetch. All URLs undergo strict
                SSRF filtering, blocking loopbacks, RFC-1918 private IPs, and cloud metadata endpoints.
              </p>
            </div>

            <div className="workflow-card">
              <div className="step-number">04</div>
              <div className="workflow-card-icon">
                <Fingerprint size={22} className="text-accent" />
              </div>
              <h3>Exact Substring Ledger</h3>
              <p>
                Verdicts are rigorously enforced: a claim is only marked Supported or Contradicted if the model
                returns a 100% exact substring from the retrieved text. Paraphrases are discarded.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Architecture & Feature Comparison */}
      <section className="comparison-section">
        <div className="section-container">
          <div className="section-header-centered">
            <span className="section-tag">ENGINE ARCHITECTURE</span>
            <h2>Why Standard AI Hallucinates & How ProofTrail Fixes It</h2>
            <p>Compare standard LLM fact-checking against ProofTrail’s cryptographic evidence protocol.</p>
          </div>

          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Capability</th>
                  <th>Standard LLM / Chatbots</th>
                  <th className="highlight-column">ProofTrail AI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Web Freshness</strong></td>
                  <td>Limited by training cutoff or basic search snippets</td>
                  <td className="highlight-column">
                    <span className="table-check">✓</span> Live deep DOM search via TinyFish API
                  </td>
                </tr>
                <tr>
                  <td><strong>Quotation Integrity</strong></td>
                  <td>Hallucinates fake quotes or re-worded paraphrases</td>
                  <td className="highlight-column">
                    <span className="table-check">✓</span> Python-level exact substring verification
                  </td>
                </tr>
                <tr>
                  <td><strong>Discrepancy Handling</strong></td>
                  <td>Forces a speculative Yes/No guess</td>
                  <td className="highlight-column">
                    <span className="table-check">✓</span> Explicit <code>MIXED</code> and <code>UNVERIFIED</code> statuses
                  </td>
                </tr>
                <tr>
                  <td><strong>Evidence Traceability</strong></td>
                  <td>Black-box output; citations often 404 or broken</td>
                  <td className="highlight-column">
                    <span className="table-check">✓</span> Full audit log with timestamped source URLs & publishers
                  </td>
                </tr>
                <tr>
                  <td><strong>Security Hardening</strong></td>
                  <td>Vulnerable to prompt injection inside retrieved web pages</td>
                  <td className="highlight-column">
                    <span className="table-check">✓</span> Untrusted data demarcation + SSRF IP shielding
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Live Benchmark Example Showcase */}
      <section className="example-showcase-section">
        <div className="section-container">
          <div className="section-header-split">
            <div>
              <span className="section-tag">BENCHMARK DEMONSTRATION</span>
              <h2>Interactive Verified Investigation Report</h2>
              <p>Explore an end-to-end investigation report with all four evidence statuses.</p>
            </div>
            <div className="example-selector-pills">
              {EXAMPLE_INVESTIGATION_REPORTS.map((rep, idx) => (
                <button
                  type="button"
                  key={rep.investigation_id}
                  className={`selector-pill ${selectedExampleIndex === idx ? 'active' : ''}`}
                  onClick={() => setSelectedExampleIndex(idx)}
                >
                  Case 0{idx + 1}: {idx === 0 ? 'STEM Scholarship Claim' : 'AI Remote Internship Claim'}
                </button>
              ))}
            </div>
          </div>

          <div className="example-report-preview-box">
            <div className="preview-top-banner">
              <div className="preview-meta">
                <span className="demo-indicator-tag">DEMO BENCHMARK</span>
                <span className="preview-id">ID: {activeExample.investigation_id}</span>
                <StatusBadge status={activeExample.status} size="sm" />
              </div>
              <button
                type="button"
                className="btn-open-full-report"
                onClick={() => onStartInvestigation(activeExample.input_text, activeExample.input_url)}
              >
                <span>Investigate This Claim Live</span>
                <ArrowRight size={14} />
              </button>
            </div>

            <div className="preview-claim-header">
              <span className="preview-label">INVESTIGATED CLAIM</span>
              <h3>“{activeExample.input_text}”</h3>
              <div className="preview-stats-row">
                <span><Globe2 size={13} /> {activeExample.sources.length} sources crawled</span>
                <span><CheckCircle2 size={13} className="text-emerald" /> {activeExample.findings.filter(f => f.status === 'SUPPORTED').length} Supported</span>
                <span><XCircle size={13} className="text-rose" /> {activeExample.findings.filter(f => f.status === 'CONTRADICTED').length} Contradicted</span>
                <span><HelpCircle size={13} className="text-muted" /> {activeExample.findings.filter(f => f.status === 'UNVERIFIED').length} Unverified</span>
              </div>
            </div>

            <div className="preview-findings-list">
              {activeExample.findings.slice(0, 3).map((f) => {
                const claimUnit = activeExample.claim_units.find(c => c.id === f.claim_unit_id);
                const evId = f.evidence_ids[0];
                const ev = activeExample.evidence.find(e => e.id === evId);
                const src = activeExample.sources.find(s => (s.evidence || []).some(e => e.id === evId));

                return (
                  <div key={f.claim_unit_id} className="preview-finding-card">
                    <div className="preview-finding-headline">
                      <h4>{claimUnit?.claim_text}</h4>
                      <StatusBadge status={f.status} size="sm" />
                    </div>
                    <p className="preview-rationale">{f.rationale}</p>
                    {ev && (
                      <div className="preview-citation-quote">
                        <span className="quote-tag">{ev.relation} · {src?.publisher}</span>
                        <blockquote>“{ev.passage}”</blockquote>
                        {src?.final_url && (
                          <a href={src.final_url} target="_blank" rel="noopener noreferrer" className="quote-link">
                            Inspect source DOM <ExternalLink size={12} />
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="section-container footer-inner">
          <div className="footer-col-brand">
            <div className="footer-logo">
              <Fingerprint size={22} className="text-accent" />
              <span>PROOFTRAIL <strong>AI</strong></span>
            </div>
            <p className="footer-desc">
              Autonomous AI investigation & claim verification platform powered by TinyFish.
              Open-source, evidence-first, zero hallucinations.
            </p>
            <div className="footer-tech-stack">
              <span>FastAPI</span>
              <span>•</span>
              <span>TinyFish Search & Fetch</span>
              <span>•</span>
              <span>React</span>
              <span>•</span>
              <span>SQLite</span>
            </div>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Navigation</h4>
              <button type="button" onClick={() => onNavigate('dashboard')}>Dashboard</button>
              <button type="button" onClick={() => onNavigate('new')}>New Investigation</button>
              <button type="button" onClick={() => onNavigate('history')}>Audit History</button>
            </div>

            <div className="footer-col">
              <h4>Open Source</h4>
              <a href="https://github.com/Rahulkk12/prooftrail-ai" target="_blank" rel="noopener noreferrer">
                GitHub Repository <ArrowUpRight size={12} />
              </a>
              <a href="https://github.com/Rahulkk12/prooftrail-ai/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">
                MIT License <ArrowUpRight size={12} />
              </a>
              <a href="https://github.com/Rahulkk12/prooftrail-ai/blob/main/docs/TEST_PLAN.md" target="_blank" rel="noopener noreferrer">
                Test Plan <ArrowUpRight size={12} />
              </a>
            </div>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div className="section-container bottom-bar-inner">
            <span>© 2026 PROOFTRAIL AI · Team Flux. Built for hackathon demonstration.</span>
            <span>A status assesses retrieved evidence; it does not claim infallibility.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
