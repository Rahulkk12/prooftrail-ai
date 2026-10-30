import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  PlusCircle,
  Search,
  Filter,
  ArrowRight,
  Clock,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Globe2,
  FileText,
  AlertCircle,
  TrendingUp,
  BarChart3,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import SummaryStatistics from '../components/SummaryStatistics';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { listInvestigations } from '../api/client';


export default function DashboardPage({ onNavigate, onSelectReport, onStartInvestigation, onLoadExample }) {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [offlineNotice, setOfflineNotice] = useState('');

  const fetchInvestigations = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await listInvestigations(50);
      setInvestigations(data.investigations || []);
      if (data.offlineNotice) {
        setOfflineNotice(data.offlineNotice);
      }
    } catch (err) {
      setError(err.message || 'Failed to load investigations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvestigations();
  }, []);

  // Filtered investigations list
  const filtered = investigations.filter((inv) => {
    const claim = (inv.input_text || '').toLowerCase();
    const id = (inv.id || '').toLowerCase();
    const url = (inv.input_url || '').toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesQuery = !query || claim.includes(query) || id.includes(query) || url.includes(query);
    if (!matchesQuery) return false;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'COMPLETED') return inv.status === 'completed';
    if (statusFilter === 'COMPLETED_WITH_GAPS') return inv.status === 'completed_with_gaps';
    if (statusFilter === 'FAILED') return inv.status === 'failed';
    return true;
  });

  

  return (
    <div className="dashboard-page-container">
      {/* Top Banner / Greeting */}
      <div className="dashboard-top-header">
        <div>
          <h1 className="dashboard-page-title">Intelligence Overview</h1>
          <p className="dashboard-page-subtitle">
            Forensic tracking, claim verification distributions, and active audit ledgers.
          </p>
        </div>
        <div className="dashboard-top-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('new')}
          >
            <PlusCircle size={15} />
            <span>New Investigation</span>
          </button>
        </div>
      </div>

      {offlineNotice && (
        <div className="system-notice-banner">
          <AlertCircle size={15} />
          <span>{offlineNotice}</span>
        </div>
      )}

      {/* Summary KPI & Evidence Distribution */}
      <SummaryStatistics
        investigations={investigations}
        isDemo={investigations.length === 0}
      />

      {/* Quick Launch Action Banner */}
      <div className="quick-start-banner">
        <div className="banner-left">
          <div className="banner-icon-wrap">
            <Sparkles size={22} className="text-accent" />
          </div>
          <div className="banner-text">
            <h3>Verify a statement against the live web</h3>
            <p>
              Paste any announcement, article, or policy claim. TinyFish will discover source DOMs and verify exact passages.
            </p>
          </div>
        </div>
        <div className="banner-right">
          <button
            type="button"
            className="btn-banner-action"
            onClick={() => onNavigate('new')}
          >
            <span>Start Investigation</span>
            <ArrowRight size={14} />
          </button>
          <button
            type="button"
            className="btn-banner-ghost"
            onClick={handleQuickExample}
          >
            View Demo Benchmark ↗
          </button>
        </div>
      </div>

      {/* Recent Investigations Section */}
      <div className="dashboard-section-card">
        <div className="table-header-toolbar">
          <div className="toolbar-left">
            <h2 className="section-title">Audit Ledger & Recent Runs</h2>
            <span className="count-pill">{filtered.length} total</span>
          </div>

          <div className="toolbar-right">
            {/* Search Input */}
            <div className="search-input-box">
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search claim, URL, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>

            {/* Filter Pills */}
            <div className="filter-pills-group">
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                All
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
                onClick={() => setStatusFilter('COMPLETED')}
              >
                Fully Verified
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'COMPLETED_WITH_GAPS' ? 'active' : ''}`}
                onClick={() => setStatusFilter('COMPLETED_WITH_GAPS')}
              >
                With Gaps
              </button>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'FAILED' ? 'active' : ''}`}
                onClick={() => setStatusFilter('FAILED')}
              >
                Incomplete
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="table-loading-skeleton">
            <div className="skeleton-row" />
            <div className="skeleton-row" />
            <div className="skeleton-row" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={searchQuery ? 'No matching investigations' : 'No investigations recorded yet'}
            description={
              searchQuery
                ? 'Try a different search term or clear the filter.'
                : 'Start your first live web investigation or inspect an example benchmark.'
            }
            actionLabel="Start New Investigation"
            onAction={() => onNavigate('new')}
            
          />
        ) : (
          <div className="investigations-table-wrapper">
            <table className="investigations-table">
              <thead>
                <tr>
                  <th>Investigation ID / Date</th>
                  <th>Investigated Claim</th>
                  <th>Status</th>
                  <th>Findings Breakdown</th>
                  <th>Sources</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => {
                  const createdStr = inv.created_at ? new Date(inv.created_at).toLocaleString() : 'Recent';
                  const counts = inv.status_counts || {};

                  return (
                    <tr
                      key={inv.id}
                      className="table-row-clickable"
                      onClick={() => onSelectReport(inv.id)}
                    >
                      <td className="col-meta">
                        <span className="inv-id-tag">{inv.id.slice(0, 14)}</span>
                        <span className="inv-date-sub">{createdStr}</span>
                      </td>

                      <td className="col-claim">
                        <p className="claim-headline">{inv.input_text}</p>
                        {inv.input_url && (
                          <span className="claim-url-hint">
                            <Globe2 size={11} /> {inv.input_url}
                          </span>
                        )}
                      </td>

                      <td className="col-status">
                        <StatusBadge status={inv.status} size="sm" />
                      </td>

                      <td className="col-findings">
                        <div className="mini-findings-pills">
                          {counts.SUPPORTED > 0 && (
                            <span className="mini-pill pill-sup" title="Supported">
                              ✓ {counts.SUPPORTED}
                            </span>
                          )}
                          {counts.CONTRADICTED > 0 && (
                            <span className="mini-pill pill-con" title="Contradicted">
                              ✗ {counts.CONTRADICTED}
                            </span>
                          )}
                          {counts.MIXED > 0 && (
                            <span className="mini-pill pill-mix" title="Mixed">
                              ▲ {counts.MIXED}
                            </span>
                          )}
                          {counts.UNVERIFIED > 0 && (
                            <span className="mini-pill pill-unv" title="Unverified">
                              ? {counts.UNVERIFIED}
                            </span>
                          )}
                          {!counts.SUPPORTED && !counts.CONTRADICTED && !counts.MIXED && !counts.UNVERIFIED && (
                            <span className="text-muted text-xs">—</span>
                          )}
                        </div>
                      </td>

                      <td className="col-sources">
                        <span className="sources-count-badge">
                          <Globe2 size={12} /> {inv.sources_count || 0}
                        </span>
                      </td>

                      <td className="col-action">
                        <button
                          type="button"
                          className="btn-view-report"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectReport(inv.id);
                          }}
                        >
                          <span>Inspect</span>
                          <ChevronRight size={13} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
