import React from 'react';
import { ArrowLeft, Shield, Sparkles, HelpCircle, FileSearch } from 'lucide-react';
import InvestigationForm from '../components/InvestigationForm';

export default function NewInvestigationPage({ onNavigate, onStartInvestigation, isSubmitting = false }) {
  const handleFormSubmit = ({ claim, sourceUrl, scope }) => {
    onStartInvestigation(claim, sourceUrl, scope);
  };

  return (
    <div className="new-investigation-page-container">
      {/* Top Header */}
      <div className="page-header-nav">
        <button
          type="button"
          className="btn-back-nav"
          onClick={() => onNavigate('dashboard')}
        >
          <ArrowLeft size={14} />
          <span>Back to Dashboard</span>
        </button>
      </div>

      <div className="new-inv-hero-block">
        <div className="inv-badge-pill">
          <FileSearch size={14} className="text-accent" />
          <span>NEW FORENSIC INQUIRY</span>
        </div>
        <h1 className="new-inv-title">Initiate Claim Investigation</h1>
        <p className="new-inv-desc">
          Paste any public claim, policy announcement, or news excerpt. ProofTrail will decompose it into atomic
          facts, search live web sources with TinyFish, and extract verbatim quotes.
        </p>
      </div>

      <div className="new-inv-form-card">
        <InvestigationForm
          onSubmit={handleFormSubmit}
          isSubmitting={isSubmitting}
        />
      </div>

      {/* Helpful Guidelines Card */}
      <div className="guidelines-card">
        <div className="guidelines-header">
          <Shield size={16} className="text-accent" />
          <h4>ProofTrail Evidence Standards</h4>
        </div>
        <div className="guidelines-grid">
          <div className="guideline-item">
            <strong>1. Atomic Decomposition</strong>
            <p>Compound claims (e.g., “X is launching Y with Z grant”) are split into discrete sub-claims.</p>
          </div>
          <div className="guideline-item">
            <strong>2. Verbatim Quoting Only</strong>
            <p>Every piece of evidence must exist word-for-word in the retrieved HTML/markdown source.</p>
          </div>
          <div className="guideline-item">
            <strong>3. No Forced Verdicts</strong>
            <p>If evidence is missing or ambiguous, ProofTrail leaves the field strictly marked as UNVERIFIED.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
