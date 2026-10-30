import React from 'react';
import {
  FileSearch,
  Search,
  Globe2,
  CheckCircle2,
  Fingerprint,
  Loader2,
  Clock,
  AlertCircle,
  FileCheck
} from 'lucide-react';

const STAGES = [
  {
    id: 'claim_decomposition',
    title: 'Atomic Claim Decomposition',
    description: 'Decomposing complex claim into verifiable sub-facts and question units',
    icon: FileSearch,
  },
  {
    id: 'tinyfish_search',
    title: 'TinyFish Web Discovery',
    description: 'Querying live web indexes for official sources, bulletins, and primary data',
    icon: Search,
  },
  {
    id: 'tinyfish_fetch',
    title: 'Content Retrieval & SSRF Validation',
    description: 'Fetching markdown DOMs and validating public IP routing and safe URLs',
    icon: Globe2,
  },
  {
    id: 'evidence_assessment',
    title: 'Evidence Cross-Referencing',
    description: 'Extracting exact verbatim substrings and strictly mapping evidence relationships',
    icon: Fingerprint,
  },
  {
    id: 'report_generation',
    title: 'Cryptographic Audit & Report Assembly',
    description: 'Downgrading unbacked verdicts and compiling the immutable investigation ledger',
    icon: FileCheck,
  },
];

export default function ProgressTimeline({ activeStepIndex = 0, runLog = [], isRunning = false, elapsedTime = 0 }) {
  // If we have a completed runLog from the server, we match against it
  const logMap = new Map();
  if (Array.isArray(runLog)) {
    runLog.forEach((log) => {
      logMap.set(log.step, log);
    });
  }

  return (
    <div className="progress-timeline-wrapper">
      <div className="progress-timeline-header">
        <div className="timeline-title-area">
          <h3>Evidence Pipeline Progress</h3>
          <p>Real-time execution across TinyFish crawler and verification engine</p>
        </div>
        {isRunning && (
          <div className="timeline-timer">
            <Clock size={14} className="timer-icon" />
            <span>Elapsed: {elapsedTime}s</span>
            <span className="live-status-pill">● LIVE IN-FLIGHT</span>
          </div>
        )}
      </div>

      <div className="progress-stages-list">
        {STAGES.map((stage, idx) => {
          const logEntry = logMap.get(stage.id);
          const Icon = stage.icon;

          let status = 'pending'; // 'pending', 'active', 'completed', 'error'
          if (isRunning) {
            if (idx < activeStepIndex) {
              status = 'completed';
            } else if (idx === activeStepIndex) {
              status = 'active';
            } else {
              status = 'pending';
            }
          } else if (logEntry) {
            status = logEntry.status === 'failed' ? 'error' : 'completed';
          } else if (idx <= activeStepIndex) {
            status = 'completed';
          }

          return (
            <div key={stage.id} className={`timeline-stage-item stage-${status}`}>
              <div className="stage-indicator-column">
                <div className="stage-icon-circle">
                  {status === 'active' && <Loader2 size={16} className="animate-spin text-accent" />}
                  {status === 'completed' && <CheckCircle2 size={16} className="text-emerald" />}
                  {status === 'error' && <AlertCircle size={16} className="text-rose" />}
                  {status === 'pending' && <Icon size={16} className="text-muted" />}
                </div>
                {idx < STAGES.length - 1 && <div className={`stage-connecting-line line-${status}`} />}
              </div>

              <div className="stage-content">
                <div className="stage-headline">
                  <span className="stage-step-tag">Phase 0{idx + 1}</span>
                  <h4 className="stage-title">{stage.title}</h4>
                  <span className={`stage-state-badge state-${status}`}>
                    {status === 'active' && 'IN PROGRESS'}
                    {status === 'completed' && 'COMPLETED'}
                    {status === 'error' && 'ISSUE ENCOUNTERED'}
                    {status === 'pending' && 'WAITING'}
                  </span>
                </div>
                <p className="stage-desc">{stage.description}</p>

                {logEntry && (
                  <div className="stage-log-meta">
                    {logEntry.timestamp && <span>Recorded at {new Date(logEntry.timestamp).toLocaleTimeString()}</span>}
                    {logEntry.count !== undefined && <span>{logEntry.count} sources discovered</span>}
                    {logEntry.fetched !== undefined && <span>{logEntry.fetched} pages analyzed</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
