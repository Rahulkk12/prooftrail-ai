import React, { useState } from 'react';
import { Search, Globe2, ArrowUpRight, Sparkles, AlertCircle, Shield, Sliders } from 'lucide-react';

const PRESET_EXAMPLES = [
  {
    label: 'Scholarship Announcement',
    claim: 'The Government of India announced a ₹50,000 scholarship for STEM students under 25, with applications closing on 30 November 2026.',
    url: 'https://scholarships.gov.in',
  },
  {
    label: 'Remote AI Internship',
    claim: 'A company is offering a remote AI research internship with a ₹45,000 monthly stipend and guaranteed full-time placement after 90 days with no application fees.',
    url: 'https://careers.example-ai.tech',
  },
  {
    label: 'Tech Subsidy Policy',
    claim: 'The Ministry of Electronics approved a 50% capital subsidy for local semiconductor packaging facilities starting Q1 2027.',
    url: 'https://meity.gov.in',
  },
];

export default function InvestigationForm({ onSubmit, isSubmitting = false, initialClaim = '', initialUrl = '' }) {
  const [claim, setClaim] = useState(initialClaim);
  const [url, setUrl] = useState(initialUrl);
  const [scope, setScope] = useState('standard'); // 'standard' or 'deep'
  const [urlError, setUrlError] = useState('');

  const trimmedClaim = claim.trim();
  const isValidLength = trimmedClaim.length >= 12 && trimmedClaim.length <= 2000;

  const handleUrlChange = (e) => {
    const val = e.target.value;
    setUrl(val);
    if (!val.trim()) {
      setUrlError('');
      return;
    }
    try {
      const parsed = new URL(val);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setUrlError('Only public http:// and https:// URLs are allowed');
      } else if (
        parsed.hostname === 'localhost' ||
        parsed.hostname.startsWith('127.') ||
        parsed.hostname.startsWith('192.168.') ||
        parsed.hostname.startsWith('10.')
      ) {
        setUrlError('Private and localhost URLs are forbidden for security');
      } else {
        setUrlError('');
      }
    } catch {
      setUrlError('Please enter a valid URL (e.g. https://example.com)');
    }
  };

  const handleApplyPreset = (preset) => {
    setClaim(preset.claim);
    setUrl(preset.url || '');
    setUrlError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!isValidLength || isSubmitting || urlError) return;
    onSubmit({ claim: trimmedClaim, sourceUrl: url.trim() || null, scope });
  };

  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleSubmit(e);
    }
  };

  return (
    <form className="investigation-form-card" onSubmit={handleSubmit} onKeyDown={handleKeyDown}>
      <div className="form-header-row">
        <label htmlFor="claim-input" className="form-label">
          Claim or Statement to Verify <span className="text-rose">*</span>
        </label>
        <span className={`char-counter ${claim.length > 1800 ? 'counter-warn' : ''}`}>
          {claim.length} / 2,000 characters (min 12)
        </span>
      </div>

      <div className="textarea-wrapper">
        <textarea
          id="claim-input"
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          placeholder="Paste the statement, news quote, hiring announcement, scholarship, or public policy claim you want to investigate..."
          rows={4}
          maxLength={2000}
          required
          disabled={isSubmitting}
          className="claim-textarea"
        />
      </div>

      {/* Preset Chips */}
      <div className="presets-row">
        <span className="presets-label">
          <Sparkles size={12} /> Try example:
        </span>
        <div className="preset-chips">
          {PRESET_EXAMPLES.map((preset, idx) => (
            <button
              type="button"
              key={idx}
              className="preset-chip"
              onClick={() => handleApplyPreset(preset)}
              disabled={isSubmitting}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Source URL & Scope Settings */}
      <div className="form-settings-grid">
        <div className="url-input-block">
          <label htmlFor="source-url-input" className="form-sublabel">
            Optional Original Source URL
          </label>
          <div className={`url-input-wrapper ${urlError ? 'input-error' : ''}`}>
            <Globe2 size={16} className="input-icon" />
            <input
              id="source-url-input"
              type="url"
              value={url}
              onChange={handleUrlChange}
              placeholder="https://example.com/article-or-announcement"
              disabled={isSubmitting}
              className="url-input"
            />
          </div>
          {urlError && (
            <div className="field-error-hint">
              <AlertCircle size={12} /> <span>{urlError}</span>
            </div>
          )}
        </div>

        <div className="scope-select-block">
          <label className="form-sublabel">Investigation Depth</label>
          <div className="scope-options">
            <button
              type="button"
              className={`scope-pill ${scope === 'standard' ? 'active' : ''}`}
              onClick={() => setScope('standard')}
              disabled={isSubmitting}
            >
              Standard Verification
            </button>
            <button
              type="button"
              className={`scope-pill ${scope === 'deep' ? 'active' : ''}`}
              onClick={() => setScope('deep')}
              disabled={isSubmitting}
            >
              Exhaustive Audit
            </button>
          </div>
        </div>
      </div>

      {/* Form Submission Action */}
      <div className="form-submit-row">
        <div className="submit-hint">
          <Shield size={14} className="text-muted" />
          <span>TinyFish retrieves live web evidence. Exact quotes are verified against source DOMs.</span>
        </div>

        <div className="submit-action-group">
          <span className="key-hint">Press Ctrl + Enter</span>
          <button
            type="submit"
            className="btn-submit-investigation"
            disabled={!isValidLength || !!urlError || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="spinner-dot" /> Investigating...
              </>
            ) : (
              <>
                <Search size={15} />
                <span>Investigate Claim</span>
                <ArrowUpRight size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}
