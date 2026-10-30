import React from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  History,
  FileText,
  Activity,
  Cpu,
  Database,
  Globe2,
  ShieldCheck,
  ChevronRight,
  Sparkles
} from 'lucide-react';

export default function Sidebar({ currentRoute, onNavigate, health, isRunning = false, activeReportId = null }) {
  const isOnline = health?.connected && health?.status === 'ok';

  return (
    <aside className="app-sidebar" aria-label="Sidebar Navigation">
      <div className="sidebar-section">
        <span className="sidebar-section-title">INTELLIGENCE WORKSPACE</span>
        <nav className="sidebar-nav-list">
          <button
            type="button"
            className={`sidebar-nav-item ${currentRoute === 'dashboard' ? 'active' : ''}`}
            onClick={() => onNavigate('dashboard')}
          >
            <LayoutDashboard size={16} className="nav-icon" />
            <span className="nav-label">Dashboard</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${currentRoute === 'new' ? 'active' : ''}`}
            onClick={() => onNavigate('new')}
          >
            <PlusCircle size={16} className="nav-icon" />
            <span className="nav-label">New Investigation</span>
            <span className="sidebar-badge-new">+</span>
          </button>

          <button
            type="button"
            className={`sidebar-nav-item ${currentRoute === 'history' ? 'active' : ''}`}
            onClick={() => onNavigate('history')}
          >
            <History size={16} className="nav-icon" />
            <span className="nav-label">Audit History</span>
          </button>
        </nav>
      </div>

      {/* Active Run or Report Context */}
      {(isRunning || activeReportId) && (
        <div className="sidebar-section">
          <span className="sidebar-section-title">ACTIVE INVESTIGATION</span>
          {isRunning ? (
            <button
              type="button"
              className={`sidebar-run-card running ${currentRoute === 'progress' ? 'active' : ''}`}
              onClick={() => onNavigate('progress')}
            >
              <div className="run-pulse-dot" />
              <div className="run-card-info">
                <strong>Live Pipeline</strong>
                <span>In-flight analysis</span>
              </div>
              <ChevronRight size={14} className="run-arrow" />
            </button>
          ) : (
            <button
              type="button"
              className={`sidebar-run-card ${currentRoute === 'report' ? 'active' : ''}`}
              onClick={() => onNavigate('report')}
            >
              <FileText size={15} className="text-accent" />
              <div className="run-card-info">
                <strong>Active Report</strong>
                <span className="mono-sub">{activeReportId.slice(0, 12)}...</span>
              </div>
              <ChevronRight size={14} className="run-arrow" />
            </button>
          )}
        </div>
      )}

      {/* Engine Status / System Diagnostics */}
      <div className="sidebar-engine-box">
        <span className="sidebar-section-title">ENGINE DIAGNOSTICS</span>
        <div className="diagnostic-item">
          <div className="diagnostic-label">
            <Globe2 size={13} />
            <span>TinyFish Crawler</span>
          </div>
          <span className={`diagnostic-status ${health?.tinyfishConfigured ? 'status-ready' : 'status-warn'}`}>
            {health?.tinyfishConfigured ? 'CONNECTED' : 'UNCONFIGURED'}
          </span>
        </div>

        <div className="diagnostic-item">
          <div className="diagnostic-label">
            <Cpu size={13} />
            <span>LLM Evaluator</span>
          </div>
          <span className={`diagnostic-status ${health?.llmConfigured ? 'status-ready' : 'status-warn'}`}>
            {health?.llmConfigured ? 'READY' : 'UNCONFIGURED'}
          </span>
        </div>

        <div className="diagnostic-item">
          <div className="diagnostic-label">
            <Database size={13} />
            <span>Audit Ledger</span>
          </div>
          <span className="diagnostic-status status-ready">SQLITE (LOCAL)</span>
        </div>
      </div>
    </aside>
  );
}
