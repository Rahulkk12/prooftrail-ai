import React, { useState } from 'react';
import { ArrowUpRight, Copy, Check, Quote, ShieldAlert, Sparkles } from 'lucide-react';

export default function EvidenceCard({ evidence, source }) {
  const [copied, setCopied] = useState(false);

  if (!evidence) return null;

  const relation = evidence.relation || 'CONTEXT';
  const relationStyles = {
    SUPPORTS: {
      tag: 'Supports Claim',
      className: 'relation-supports',
      borderColor: 'var(--color-supported)',
    },
    CONTRADICTS: {
      tag: 'Contradicts Claim',
      className: 'relation-contradicts',
      borderColor: 'var(--color-contradicted)',
    },
    CONTEXT: {
      tag: 'Relevant Context',
      className: 'relation-context',
      borderColor: 'var(--color-unverified)',
    },
  }[relation] || { tag: relation, className: 'relation-context' };

  const handleCopy = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(evidence.passage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const publisher = source?.publisher || source?.title || 'External Source';
  const url = source?.final_url || source?.url;

  return (
    <div className={`evidence-card ${relationStyles.className}`}>
      <div className="evidence-header">
        <div className="evidence-meta">
          <span className={`evidence-relation-tag ${relationStyles.className}`}>
            {relationStyles.tag}
          </span>
          <span className="evidence-publisher">{publisher}</span>
        </div>
        <div className="evidence-actions">
          <button
            type="button"
            className="action-icon-btn"
            onClick={handleCopy}
            title="Copy exact passage text"
            aria-label="Copy exact passage"
          >
            {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
          </button>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="action-icon-btn"
              title="Open source in new tab"
              aria-label="Open source link"
            >
              <ArrowUpRight size={14} />
            </a>
          )}
        </div>
      </div>

      <blockquote className="evidence-quote">
        <Quote size={14} className="quote-mark" />
        <span className="quote-text">{evidence.passage}</span>
      </blockquote>

      {(evidence.extracted_value || evidence.limitations) && (
        <div className="evidence-footer">
          {evidence.extracted_value && (
            <div className="extracted-fact">
              <span className="fact-label">Extracted Finding:</span>
              <strong className="fact-value">{evidence.extracted_value}</strong>
            </div>
          )}
          {evidence.limitations && (
            <div className="evidence-limitation" title="Evaluation context">
              <ShieldAlert size={12} />
              <span>{evidence.limitations}</span>
            </div>
          )}
        </div>
      )}

      <div className="evidence-subtext">
        <span>Verified exact substring match from retrieved DOM</span>
      </div>
    </div>
  );
}
