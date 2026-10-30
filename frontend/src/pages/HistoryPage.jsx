import React, { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Globe2,
  FileText,
  RotateCcw,
  Download,
  Calendar,
  Layers,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import StatusBadge from '../components/StatusBadge';
import EmptyState from '../components/EmptyState';
import { listInvestigations } from '../api/client';
import { EXAMPLE_INVESTIGATION_REPORTS } from '../data/exampleReports';

export default function HistoryPage({ onNavigate, onSelectReport, onRetry, onLoadExample }) {
  const [investigations, setInvestigations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' or 'asc'

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await listInvestigations(100);
      setInvestigations(res.investigations || []);
    } catch {
      // client automatically handles fallback
    } finally {
      setLoading(false);
    }
  };

  const filtered = investigations
    .filter((inv) => {
      const claim = (inv.input_text || '').toLowerCase();
      const id = (inv.id || '').toLowerCase();
      const url = (inv.input_url || '').toLowerCase();
      const q = searchQuery.toLowerCase().trim();

      const matchesSearch = !q || claim.includes(q) || id.includes(q) || url.includes(q);
      if (!matchesSearch) return false;

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'COMPLETED') return inv.status === 'completed';
      if (statusFilter === 'COMPLETED_WITH_GAPS') return inv.status === 'completed_with_gaps';
      if (statusFilter === 'FAILED') return inv.status === 'failed';
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

  const handleExportAll = () => {
    const jsonStr = JSON.stringify(investigations, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prooftrail-audit-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="history-page-container">
      {/* Top Header */}
      <div className="history-header-block">
        <div>
          <h1 className="history-title">Forensic Audit History</h1>
          <p className="history-subtitle">
            Auditable trail of all past investigations, live web crawls, and evidence findings.
          </p>
        </div>

        <div className="history-top-actions">
          {investigations.length > 0 && (
            <button
              type="button"
              className="btn-action-outline"
              onClick={handleExportAll}
              title="Export all logged investigations to JSON"
            >
              <Download size={14} />
              <span>Export History JSON</span>
            </button>
          )}
          <button
            type="button"
            className="btn-primary"
            onClick={() => onNavigate('new')}
          >
            <span>New Investigation</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="history-toolbar">
        <div className="search-box-large">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Filter by statement text, referenced URL, or investigation ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="history-filters-row">
          <div className="status-filter-pills">
            <button
              type="button"
              className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
              onClick={() => setStatusFilter('ALL')}
            >
              All Records ({investigations.length})
            </button>
            <button
              type="button"
              className={`filter-pill ${statusFilter === 'COMPLETED' ? 'active' : ''}`}
              onClick={() => setStatusFilter('COMPLETED')}
            >
              Verified
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

          <button
            type="button"
            className="sort-toggle-btn"
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
          >
            <Calendar size={13} />
            <span>{sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}</span>
          </button>
        </div>
      </div>

      {/* Investigations List */}
      {loading ? (
        <div className="history-loading-list">
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={searchQuery ? 'No matching investigations' : 'No saved investigations yet'}
          description={
            searchQuery
              ? 'Try adjusting your search keywords or clear the filter.'
              : 'Launch your first live web investigation or inspect a demo benchmark report.'
          }
          actionLabel="Start New Investigation"
          onAction={() => onNavigate('new')}
          secondaryActionLabel="Inspect Demo Benchmark"
          onSecondaryAction={() => onLoadExample(EXAMPLE_INVESTIGATION_REPORTS[0])}
        />
      ) : (
        <div className="history-cards-grid">
          {filtered.map((inv) => {
            const dateStr = inv.created_at ? new Date(inv.created_at).toLocaleString() : 'Recent';
            const counts = inv.status_counts || {};

            return (
              <div
                key={inv.id}
                className="history-entry-card"
                onClick={() => onSelectReport(inv.id)}
              >
                <div className="card-top-meta">
                  <span className="card-inv-id">{inv.id}</span>
                  <StatusBadge status={inv.status} size="sm" />
                </div>

                <h3 className="card-claim-text">{inv.input_text}</h3>

                {inv.input_url && (
                  <span className="card-url-reference">
                    <Globe2 size={12} /> {inv.input_url}
                  </span>
                )}

                <div className="card-findings-summary">
                  <div className="findings-counts">
                    {counts.SUPPORTED > 0 && <span className="count-tag tag-sup">✓ {counts.SUPPORTED}</span>}
                    {counts.CONTRADICTED > 0 && <span className="count-tag tag-con">✗ {counts.CONTRADICTED}</span>}
                    {counts.MIXED > 0 && <span className="count-tag tag-mix">▲ {counts.MIXED}</span>}
                    {counts.UNVERIFIED > 0 && <span className="count-tag tag-unv">? {counts.UNVERIFIED}</span>}
                  </div>
                  <span className="sources-count">
                    <Globe2 size={12} /> {inv.sources_count || 0} sources
                  </span>
                </div>

                <div className="card-footer-bar">
                  <span className="card-timestamp">
                    <Clock size={12} /> {dateStr}
                  </span>
                  <div className="card-actions-group">
                    {onRetry && (
                      <button
                        type="button"
                        className="btn-card-retry"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRetry(inv.id);
                        }}
                        title="Rerun investigation"
                      >
                        <RotateCcw size={13} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn-card-inspect"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectReport(inv.id);
                      }}
                    >
                      <span>Inspect Report</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
