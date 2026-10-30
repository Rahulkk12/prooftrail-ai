import React, { useState } from 'react';
import { Globe2, ArrowUpRight, Copy, Check, Clock, ShieldCheck, FileText } from 'lucide-react';

export default function SourceCard({ source }) {
  const [copied, setCopied] = useState(false);

  if (!source) return null;

  const url = source.final_url || source.url;
  let domain = 'external-source';
  try {
    domain = new URL(url).hostname;
  } catch {
    domain = source.publisher || 'web';
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const accessedDate = source.accessed_at ? new Date(source.accessed_at).toLocaleString() : null;
  const publishedDate = source.published_at ? new Date(source.published_at).toLocaleDateString() : null;
  const evidenceCount = (source.evidence || []).length;

  return (
    <div className="source-card">
      <div className="source-card-top">
        <div className="source-domain-badge">
          <Globe2 size={13} />
          <span>{domain}</span>
        </div>
        <div className="source-card-actions">
          <button
            type="button"
            className="action-icon-btn"
            onClick={handleCopy}
            title="Copy URL"
            aria-label="Copy source URL"
          >
            {copied ? <Check size={14} className="text-emerald" /> : <Copy size={14} />}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="action-link-btn"
            title="Open original webpage"
            aria-label="Open source link"
          >
            Visit Source <ArrowUpRight size={13} />
          </a>
        </div>
      </div>

      <h4 className="source-title">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {source.title || domain}
        </a>
      </h4>

      <div className="source-meta-row">
        <span className="source-publisher">
          <strong>Publisher:</strong> {source.publisher || domain}
        </span>
        {publishedDate && (
          <span className="source-published">
            <strong>Published:</strong> {publishedDate}
          </span>
        )}
      </div>

      <div className="source-card-footer">
        <div className="source-retrieval-info">
          <span className="method-tag">
            <ShieldCheck size={11} /> {source.retrieval_method || 'TinyFish Fetch'}
          </span>
          {accessedDate && (
            <span className="accessed-time">
              <Clock size={11} /> Accessed {accessedDate}
            </span>
          )}
        </div>
        <div className="source-evidence-pill" title="Validated quotes extracted from this source">
          <FileText size={11} /> {evidenceCount} {evidenceCount === 1 ? 'passage cited' : 'passages cited'}
        </div>
      </div>
    </div>
  );
}
