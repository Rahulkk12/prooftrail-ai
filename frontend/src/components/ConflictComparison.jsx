import React from 'react';
import { AlertTriangle, ShieldCheck, CheckCircle2, XCircle, ExternalLink, ArrowRight } from 'lucide-react';

export default function ConflictComparison({ report }) {
  if (!report) return null;

  const claimUnits = report.claim_units || [];
  const findings = report.findings || [];
  const sources = report.sources || [];

  // Find claims that have conflicting evidence or MIXED status
  const conflictedClaims = findings.filter((f) => {
    if (f.status === 'MIXED') return true;
    const evIds = f.evidence_ids || [];
    const evList = (report.evidence || []).filter((e) => evIds.includes(e.id));
    const relations = new Set(evList.map((e) => e.relation));
    return relations.has('SUPPORTS') && relations.has('CONTRADICTS');
  });

  if (conflictedClaims.length === 0) {
    return (
      <div className="conflict-consensus-card">
        <div className="consensus-icon-box">
          <ShieldCheck size={28} className="text-emerald" />
        </div>
        <div className="consensus-text">
          <h4>No Direct Evidence Conflicts Detected</h4>
          <p>
            Across all {sources.length} retrieved sources and {(report.evidence || []).length} cited passages,
            no contradictory statements were found. The evidence trail demonstrates either uniform alignment or specific unverified gaps.
          </p>
        </div>
      </div>
    );
  }

  const getSourceForEvidence = (evId) => {
    return sources.find((s) => (s.evidence || []).some((e) => e.id === evId));
  };

  return (
    <div className="conflict-comparison-container">
      <div className="conflict-header-bar">
        <div className="conflict-alert-tag">
          <AlertTriangle size={15} />
          <span>Active Discrepancies ({conflictedClaims.length})</span>
        </div>
        <p className="conflict-subtitle">
          ProofTrail flagged diverging evidence across retrieved publications. Review both perspectives below:
        </p>
      </div>

      <div className="conflict-items-list">
        {conflictedClaims.map((finding) => {
          const claim = claimUnits.find((c) => c.id === finding.claim_unit_id);
          const evList = (report.evidence || []).filter((e) => (finding.evidence_ids || []).includes(e.id));
          const supporting = evList.filter((e) => e.relation === 'SUPPORTS');
          const contradicting = evList.filter((e) => e.relation === 'CONTRADICTS');

          return (
            <div key={finding.claim_unit_id} className="conflict-field-card">
              <div className="conflict-field-title">
                <span className="field-label">Disputed Claim Unit</span>
                <h5>{claim?.claim_text || 'Claim Field'}</h5>
              </div>

              <div className="conflict-split-grid">
                {/* Supporting Side */}
                <div className="conflict-column column-support">
                  <div className="column-header">
                    <CheckCircle2 size={15} className="text-emerald" />
                    <h6>Supporting Passages ({supporting.length})</h6>
                  </div>
                  {supporting.length === 0 ? (
                    <p className="no-side-evidence">No supporting statements</p>
                  ) : (
                    supporting.map((ev) => {
                      const src = getSourceForEvidence(ev.id);
                      return (
                        <div key={ev.id} className="conflict-quote-box quote-support">
                          <p className="quote-text">“{ev.passage}”</p>
                          <div className="quote-source">
                            <span>{src?.publisher || 'Source'}</span>
                            {src?.final_url && (
                              <a href={src.final_url} target="_blank" rel="noopener noreferrer">
                                View <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Contradicting Side */}
                <div className="conflict-column column-contradict">
                  <div className="column-header">
                    <XCircle size={15} className="text-rose" />
                    <h6>Contradicting Passages ({contradicting.length})</h6>
                  </div>
                  {contradicting.length === 0 ? (
                    <p className="no-side-evidence">No contradicting statements</p>
                  ) : (
                    contradicting.map((ev) => {
                      const src = getSourceForEvidence(ev.id);
                      return (
                        <div key={ev.id} className="conflict-quote-box quote-contradict">
                          <p className="quote-text">“{ev.passage}”</p>
                          <div className="quote-source">
                            <span>{src?.publisher || 'Source'}</span>
                            {src?.final_url && (
                              <a href={src.final_url} target="_blank" rel="noopener noreferrer">
                                View <ExternalLink size={11} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {finding.rationale && (
                <div className="conflict-rationale-box">
                  <strong>Analytical Synthesis:</strong> {finding.rationale}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
