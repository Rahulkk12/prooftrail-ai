/**
 * PROOFTRAIL AI - API Client
 * Enterprise-grade client with error resilience, cache sync, and transparent status reporting.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL
  ? import.meta.env.VITE_API_BASE_URL
  : ''
).replace(/\/$/, '');
const CACHE_KEY = 'prooftrail_investigations_cache';

export async function checkHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      connected: true,
      status: data.status,
      version: data.version,
      tinyfishConfigured: !!data.tinyfish_configured,
      llmConfigured: !!data.llm_configured,
      database: data.database || 'sqlite',
    };
  } catch (err) {
    return {
      connected: false,
      status: 'offline',
      version: 'unknown',
      tinyfishConfigured: false,
      llmConfigured: false,
      database: 'offline',
      error: err.message,
    };
  }
}

export async function listInvestigations(limit = 50) {
  try {
    const res = await fetch(`${API_BASE}/api/investigations?limit=${limit}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      const list = data.investigations || [];
      // Sync fetched investigations into local cache
      syncListToCache(list);
      return { source: 'backend', investigations: list, total: data.total ?? list.length };
    }
  } catch {
    // Backend fetch failed, will fallback to local storage
  }

  // Fallback to local storage
  const cached = getLocalCachedInvestigations();
  return {
    source: 'local_storage',
    investigations: cached,
    total: cached.length,
    offlineNotice: 'Loaded from local session storage. Backend unreachable.',
  };
}

export async function getReport(investigationId) {
  if (!investigationId) throw new Error('Missing investigation ID');

  try {
    const res = await fetch(`${API_BASE}/api/investigations/${investigationId}/report`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });
    if (res.ok) {
      const report = await res.json();
      saveReportToCache(report);
      return report;
    }
    if (res.status === 404) {
      // Check local cache
      const local = getLocalReport(investigationId);
      if (local) return local;
      throw new Error('Investigation report not found on server or locally.');
    }
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.detail || `Server returned HTTP ${res.status}`);
  } catch (err) {
    const local = getLocalReport(investigationId);
    if (local) return local;
    throw err;
  }
}

export async function createInvestigation(claim, sourceUrl = null) {
  const payload = {
    claim: claim.trim(),
    source_url: sourceUrl && sourceUrl.trim() ? sourceUrl.trim() : null,
  };

  const res = await fetch(`${API_BASE}/api/investigations`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === 'string'
      ? data.detail
      : Array.isArray(data.detail)
        ? data.detail.map(d => d.msg || JSON.stringify(d)).join('; ')
        : 'Failed to initiate investigation';
    throw new Error(detail);
  }

  saveReportToCache(data);
  return data;
}

export async function retryInvestigation(investigationId) {
  const res = await fetch(`${API_BASE}/api/investigations/${investigationId}/retry`, {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.detail || 'Failed to retry investigation');
  }

  saveReportToCache(data);
  return data;
}

// ----------------- Local Storage Helpers -----------------

export function getLocalCachedInvestigations() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getLocalReport(id) {
  try {
    const raw = localStorage.getItem(`prooftrail_report_${id}`);
    if (raw) return JSON.parse(raw);
    const list = getLocalCachedInvestigations();
    const item = list.find(x => x.id === id);
    if (item && item.full_report) return item.full_report;
    return null;
  } catch {
    return null;
  }
}

export function saveReportToCache(report) {
  if (!report || !report.investigation_id) return;
  try {
    localStorage.setItem(`prooftrail_report_${report.investigation_id}`, JSON.stringify(report));

    const currentList = getLocalCachedInvestigations();
    const existingIndex = currentList.findIndex(x => x.id === report.investigation_id);

    const summaryItem = {
      id: report.investigation_id,
      input_text: report.input_text,
      input_url: report.input_url,
      status: report.status,
      created_at: report.created_at,
      completed_at: report.checked_at,
      findings_count: (report.findings || []).length,
      sources_count: (report.sources || []).length,
      status_counts: {
        SUPPORTED: (report.findings || []).filter(f => f.status === 'SUPPORTED').length,
        CONTRADICTED: (report.findings || []).filter(f => f.status === 'CONTRADICTED').length,
        MIXED: (report.findings || []).filter(f => f.status === 'MIXED').length,
        UNVERIFIED: (report.findings || []).filter(f => f.status === 'UNVERIFIED').length,
      },
      full_report: report,
    };

    if (existingIndex >= 0) {
      currentList[existingIndex] = summaryItem;
    } else {
      currentList.unshift(summaryItem);
    }

    // Keep up to 100 recent investigations
    localStorage.setItem(CACHE_KEY, JSON.stringify(currentList.slice(0, 100)));
  } catch (e) {
    console.warn('Could not cache report to localStorage:', e);
  }
}

function syncListToCache(backendList) {
  try {
    const currentList = getLocalCachedInvestigations();
    const map = new Map();
    // Prioritize existing full_report cache
    for (const item of currentList) {
      map.set(item.id, item);
    }
    for (const item of backendList) {
      const existing = map.get(item.id) || {};
      map.set(item.id, { ...existing, ...item });
    }
    const merged = Array.from(map.values()).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    localStorage.setItem(CACHE_KEY, JSON.stringify(merged.slice(0, 100)));
  } catch (e) {
    console.warn('Could not sync list to cache:', e);
  }
}
