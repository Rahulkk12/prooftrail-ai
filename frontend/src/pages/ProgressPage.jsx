import React, { useState, useEffect } from 'react';
import { Loader2, ArrowLeft, RotateCcw, AlertCircle, FileSearch, ShieldCheck } from 'lucide-react';
import ProgressTimeline from '../components/ProgressTimeline';

export default function ProgressPage({
  claim,
  sourceUrl,
  isRunning,
  error,
  onRetry,
  onCancel,
}) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isRunning) return;

    setElapsedTime(0);
    setActiveStep(0);

    const interval = setInterval(() => {
      setElapsedTime((prev) => {
        const next = prev + 1;
        // Natural progression of stages while the server is processing:
        // ~0-3s: Decomposition, 3-9s: Search, 9-17s: Retrieval, 17-25s+: Evidence Assessment
        if (next < 3) {
          setActiveStep(0);
        } else if (next < 9) {
          setActiveStep(1);
        } else if (next < 17) {
          setActiveStep(2);
        } else if (next < 25) {
          setActiveStep(3);
        } else {
          setActiveStep(4);
        }
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="progress-page-container">
      <div className="progress-page-card">
        {/* Top Header */}
        <div className="progress-card-top">
          <div className="progress-claim-box">
            <span className="claim-label">INQUIRY IN PROGRESS</span>
            <h2 className="progress-claim-text">“{claim}”</h2>
            {sourceUrl && <span className="progress-url-tag">Reference: {sourceUrl}</span>}
          </div>
        </div>

        {/* Error State */}
        {error ? (
          <div className="progress-error-banner">
            <div className="error-icon-box">
              <AlertCircle size={24} className="text-rose" />
            </div>
            <div className="error-content">
              <h4>Investigation Pipeline Interrupted</h4>
              <p>{error}</p>
              <div className="error-actions">
                <button type="button" className="btn-primary" onClick={onRetry}>
                  <RotateCcw size={14} />
                  <span>Retry Investigation</span>
                </button>
                <button type="button" className="btn-secondary" onClick={onCancel}>
                  <ArrowLeft size={14} />
                  <span>Back to Form</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Normal Running Progress */
          <div className="progress-body">
            <ProgressTimeline
              activeStepIndex={activeStep}
              isRunning={isRunning}
              elapsedTime={elapsedTime}
            />

            <div className="progress-integrity-notice">
              <ShieldCheck size={16} className="text-accent" />
              <span>
                ProofTrail executes real-time web retrieval. Missing or unreachable pages will not be hallucinated into forced verdicts.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
