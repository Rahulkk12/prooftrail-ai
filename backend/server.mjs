import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Load environment from backend/.env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (key && !process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  }
}
loadEnv();

const TINYFISH_KEY = (process.env.TINYFISH_API_KEY || '').trim();
const TINYFISH_SEARCH_BASE = (process.env.TINYFISH_SEARCH_URL || process.env.TINYFISH_SEARCH_BASE || 'https://api.search.tinyfish.ai').replace(/\/$/, '');
const TINYFISH_FETCH_BASE = (process.env.TINYFISH_FETCH_URL || process.env.TINYFISH_FETCH_BASE || 'https://api.fetch.tinyfish.ai').replace(/\/$/, '');
const PORT = parseInt(process.env.PORT || '8000', 10);
const HOST = '0.0.0.0';

// 2. Database setup
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(dataDir, 'prooftrail.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS investigations (
    id TEXT PRIMARY KEY,
    input_text TEXT NOT NULL,
    input_url TEXT,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    completed_at TEXT,
    claim_units_count INTEGER DEFAULT 0,
    sources_count INTEGER DEFAULT 0,
    findings_count INTEGER DEFAULT 0,
    search_queries_json TEXT,
    limitations_json TEXT,
    report_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON investigations(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_investigations_status ON investigations(status);
`);

console.log(`[ProofTrail Engine] SQLite database initialized at ${dbPath}`);

// In-memory cache for fetched pages
const pageCache = new Map();

// Helpers
function nowIso() {
  return new Date().toISOString();
}

function isSafePublicUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '169.254.169.254' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('172.16.') ||
      host.startsWith('100.64.')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Substring extraction
function extractExactPassage(sourceText, candidateText) {
  if (!sourceText || !candidateText) return null;
  const sLower = sourceText.toLowerCase();
  const cClean = candidateText.trim().replace(/\s+/g, ' ');
  const cLower = cClean.toLowerCase();

  // 1. Direct exact substring match
  const idx = sLower.indexOf(cLower);
  if (idx !== -1) {
    return sourceText.slice(idx, idx + cClean.length);
  }

  // 2. Sentence-based search
  const sentences = sourceText.split(/[.\n!?;]+/).map(s => s.trim()).filter(s => s.length > 20);
  const words = cLower.split(/\s+/).filter(w => w.length > 3);
  let bestSentence = null;
  let bestScore = 0;

  for (const s of sentences) {
    const sLow = s.toLowerCase();
    let matches = 0;
    for (const w of words) {
      if (sLow.includes(w)) matches++;
    }
    const score = matches / Math.max(1, words.length);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestSentence = s;
    }
  }

  return bestSentence;
}

// TinyFish Search HTTP call
async function tinyfishSearch(query) {
  if (!TINYFISH_KEY) {
    throw new Error('TINYFISH_API_KEY is not configured in backend/.env.');
  }

  const searchUrl = new URL(TINYFISH_SEARCH_BASE);
  searchUrl.searchParams.set('query', query);
  searchUrl.searchParams.set('location', 'IN');
  searchUrl.searchParams.set('language', 'en');

  const headers = {
    'X-API-Key': TINYFISH_KEY,
    'Accept': 'application/json',
    'User-Agent': 'ProofTrail-AI/0.4.0',
  };

  const res = await fetch(searchUrl.toString(), { method: 'GET', headers });
  if (res.status === 429) {
    throw new Error('TinyFish Search rate limit exceeded (HTTP 429). Please retry shortly.');
  }
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`TinyFish Search HTTP ${res.status}: ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawList = data.results || data.items || (Array.isArray(data) ? data : []);
  const normalized = [];
  const seen = new Set();

  for (const item of rawList) {
    const u = item.url || item.link;
    if (u && isSafePublicUrl(u) && !seen.has(u)) {
      seen.add(u);
      normalized.push({
        url: u,
        title: item.title || item.name || u,
        snippet: item.snippet || item.description || '',
        publisher: item.site_name || item.publisher || new URL(u).hostname,
        date: item.published_date || item.date || null,
      });
    }
  }

  return normalized.slice(0, 8);
}

// TinyFish Fetch HTTP call
async function tinyfishFetch(urls) {
  if (!TINYFISH_KEY) {
    throw new Error('TINYFISH_API_KEY is not configured in backend/.env.');
  }

  const cleanUrls = urls.filter(isSafePublicUrl);
  if (cleanUrls.length === 0) return { pages: [], errors: [] };

  const cached = [];
  const uncached = [];
  for (const u of cleanUrls) {
    if (pageCache.has(u)) {
      cached.push(pageCache.get(u));
    } else {
      uncached.push(u);
    }
  }

  if (uncached.length === 0) {
    return { pages: cached, errors: [] };
  }

  const headers = {
    'X-API-Key': TINYFISH_KEY,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'ProofTrail-AI/0.4.0',
  };

  const res = await fetch(TINYFISH_FETCH_BASE, {
    method: 'POST',
    headers,
    body: JSON.stringify({ urls: uncached }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return {
      pages: cached,
      errors: [{ url: 'batch', error: `TinyFish Fetch HTTP ${res.status}: ${errText.slice(0, 160)}` }],
    };
  }

  const data = await res.json();
  const rawPages = data.results || data.pages || (Array.isArray(data) ? data : []);
  const rawErrors = data.errors || [];

  const fetched = [];
  for (const p of rawPages) {
    if (p && p.url) {
      const pageObj = {
        url: p.url,
        final_url: p.final_url || p.url,
        title: p.title || p.url,
        text: p.text || p.markdown || p.content || '',
        published_date: p.published_date || p.date || null,
        status: p.status || 200,
      };
      pageCache.set(p.url, pageObj);
      fetched.push(pageObj);
    }
  }

  return {
    pages: [...cached, ...fetched],
    errors: Array.isArray(rawErrors) ? rawErrors : [],
  };
}

// Claim decomposition
function decomposeClaim(claimText) {
  const units = [];
  let idCounter = 0;

  // 1. Core Statement
  units.push({
    id: `claim_unit_${idCounter++}`,
    category: 'PRIMARY_CLAIM',
    field_name: 'Core Assertion',
    claim_text: claimText.trim(),
    verification_question: `Does reliable web reporting confirm that: "${claimText.trim()}"?`,
    official_query: `${claimText.trim()} official notice report`,
    independent_query: `${claimText.trim()} news update fact check`,
  });

  // 2. Incident / Event Extraction
  const words = claimText.split(/\s+/);
  const keywords = words.filter(w => w.length > 3 && !['this', 'that', 'with', 'from', 'into', 'have', 'were'].includes(w.toLowerCase()));
  if (keywords.length >= 2) {
    const subject = keywords.slice(0, 3).join(' ');
    units.push({
      id: `claim_unit_${idCounter++}`,
      category: 'EVENT_SUBJECT',
      field_name: 'Subject Entity & Occurrence',
      claim_text: `Subject involving: ${subject}`,
      verification_question: `What official or verified news reports exist regarding ${subject}?`,
      official_query: `${subject} news incident official`,
      independent_query: `${subject} verified reports`,
    });
  }

  return units;
}

// Investigation Engine
async function runInvestigation(claim, sourceUrl) {
  const invId = `inv_${crypto.randomBytes(6).toString('hex')}`;
  const created = nowIso();
  const limitations = [];

  // Decompose
  const claimUnits = decomposeClaim(claim);

  // Search TinyFish
  let searchResults = [];
  try {
    searchResults = await tinyfishSearch(claim.slice(0, 300));
  } catch (err) {
    limitations.push(`TinyFish Search query failed: ${err.message}`);
  }

  // Collect candidate URLs
  const candidateUrls = [];
  if (sourceUrl && isSafePublicUrl(sourceUrl)) {
    candidateUrls.push(sourceUrl);
  }
  for (const item of searchResults) {
    if (item.url && isSafePublicUrl(item.url)) {
      candidateUrls.push(item.url);
    }
  }

  // Fetch Page Contents
  let fetchedPages = [];
  if (candidateUrls.length > 0) {
    try {
      const { pages, errors } = await tinyfishFetch(candidateUrls.slice(0, 6));
      fetchedPages = pages;
      for (const e of errors) {
        limitations.push(`Could not fetch ${e.url}: ${e.error}`);
      }
    } catch (err) {
      limitations.push(`TinyFish Fetch error: ${err.message}`);
    }
  } else {
    limitations.push('No public candidate sources were discovered for this claim.');
  }

  // Format sources
  const sources = fetchedPages.map((page, idx) => {
    const matchingSearch = searchResults.find(s => s.url === page.url) || {};
    const domain = new URL(page.final_url || page.url).hostname.toLowerCase();
    const isGov = domain.endsWith('.gov') || domain.endsWith('.gov.in') || domain.endsWith('.nic.in');
    const isNews = domain.includes('news') || domain.includes('times') || domain.includes('hindu') || domain.includes('express');

    return {
      id: `src_${crypto.randomBytes(5).toString('hex')}`,
      url: page.url,
      final_url: page.final_url || page.url,
      title: page.title || matchingSearch.title || page.url,
      publisher: matchingSearch.publisher || domain,
      published_at: page.published_date || matchingSearch.date || 'Date not reported',
      accessed_at: nowIso(),
      text: page.text || '',
      quality: {
        tier: isGov ? 'OFFICIAL_PORTAL' : (isNews ? 'REPUTABLE_NEWS' : 'GENERAL_WEB'),
        credibility: isGov ? 'HIGH' : (isNews ? 'MEDIUM' : 'MODERATE'),
        is_official: isGov,
      },
      retrieval_method: 'TinyFish Fetch',
      evidence: [],
    };
  });

  // Evaluate Evidence
  const allEvidence = [];
  const findings = [];

  for (const unit of claimUnits) {
    const matchingEvIds = [];
    let hasSupport = false;
    let hasContradict = false;
    let bestRationale = '';

    for (const src of sources) {
      const passage = extractExactPassage(src.text, unit.claim_text) || extractExactPassage(src.text, claim);
      if (passage && passage.length > 15) {
        const evId = `ev_${crypto.randomBytes(5).toString('hex')}`;
        const pLower = passage.toLowerCase();
        let relation = 'CONTEXT';

        // Check sentiment / corroboration in passage
        if (pLower.includes('fire') || pLower.includes('incident') || pLower.includes('broke out') || pLower.includes('reported') || pLower.includes('confirmed')) {
          relation = 'SUPPORTS';
          hasSupport = true;
        } else if (pLower.includes('fake') || pLower.includes('denied') || pLower.includes('false') || pLower.includes('hoax') || pLower.includes('untrue')) {
          relation = 'CONTRADICTS';
          hasContradict = true;
        }

        const evItem = {
          id: evId,
          source_id: src.id,
          source_url: src.final_url,
          publisher: src.publisher,
          claim_unit_id: unit.id,
          passage: passage.slice(0, 500),
          relation,
          extracted_at: nowIso(),
        };

        src.evidence.push(evItem);
        allEvidence.push(evItem);
        matchingEvIds.push(evId);

        if (!bestRationale && relation === 'SUPPORTS') {
          bestRationale = `Verified by exact reportage in ${src.publisher}: "${passage.slice(0, 120)}..."`;
        } else if (!bestRationale && relation === 'CONTRADICTS') {
          bestRationale = `Directly contradicted by report in ${src.publisher}: "${passage.slice(0, 120)}..."`;
        }
      }
    }

    let status = 'UNVERIFIED';
    if (hasSupport && hasContradict) {
      status = 'MIXED';
      bestRationale = 'Retrieved web sources contain conflicting or divergent accounts.';
    } else if (hasSupport) {
      status = 'SUPPORTED';
    } else if (hasContradict) {
      status = 'CONTRADICTED';
    } else {
      status = 'UNVERIFIED';
      bestRationale = sources.length > 0
        ? 'Retrieved articles do not contain explicit corroboration for this specific field.'
        : 'No public web sources were successfully retrieved for this claim.';
    }

    findings.push({
      claim_unit_id: unit.id,
      status,
      rationale: bestRationale,
      evidence_ids: matchingEvIds,
    });
  }

  // Overall status
  const statuses = findings.map(f => f.status);
  let overallStatus = 'completed';
  if (sources.length === 0) {
    overallStatus = 'completed_with_gaps';
  } else if (statuses.includes('UNVERIFIED') || limitations.length > 0) {
    overallStatus = 'completed_with_gaps';
  }

  const report = {
    investigation_id: invId,
    status: overallStatus,
    input_text: claim,
    input_url: sourceUrl || null,
    created_at: created,
    checked_at: nowIso(),
    claim_units: claimUnits,
    sources,
    findings,
    evidence: allEvidence,
    limitations,
  };

  // Persist to SQLite
  try {
    const insertStmt = db.prepare(`
      INSERT INTO investigations (
        id, input_text, input_url, status, created_at, completed_at,
        claim_units_count, sources_count, findings_count,
        search_queries_json, limitations_json, report_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertStmt.run(
      invId,
      claim,
      sourceUrl || null,
      overallStatus,
      created,
      nowIso(),
      claimUnits.length,
      sources.length,
      findings.length,
      JSON.stringify([claim]),
      JSON.stringify(limitations),
      JSON.stringify(report)
    );
  } catch (dbErr) {
    console.error('DB Insert Error:', dbErr);
  }

  return report;
}

// 3. HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-API-Key');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Body parser helper
  const readBody = () => new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });

  // Helper response
  const sendJson = (statusCode, data) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  };

  try {
    // 1. Health check
    if (req.method === 'GET' && pathname === '/api/health') {
      sendJson(200, {
        status: 'ok',
        version: '0.4.0',
        timestamp: nowIso(),
        tinyfish_configured: Boolean(TINYFISH_KEY && TINYFISH_KEY.length > 5),
        llm_configured: false,
        database: 'sqlite',
        cache_entries: pageCache.size,
        environment: 'development',
        policy: 'real_data_only',
      });
      return;
    }

    // 2. List investigations
    if (req.method === 'GET' && pathname === '/api/investigations') {
      const limit = parseInt(parsedUrl.searchParams.get('limit') || '50', 10);
      const rows = db.prepare('SELECT * FROM investigations ORDER BY created_at DESC LIMIT ?').all(limit);

      const items = rows.map(r => {
        let rep = {};
        try { rep = JSON.parse(r.report_json || '{}'); } catch {}
        const findings = rep.findings || [];
        const statusCounts = {
          SUPPORTED: findings.filter(f => f.status === 'SUPPORTED').length,
          CONTRADICTED: findings.filter(f => f.status === 'CONTRADICTED').length,
          MIXED: findings.filter(f => f.status === 'MIXED').length,
          UNVERIFIED: findings.filter(f => f.status === 'UNVERIFIED').length,
        };

        return {
          id: r.id,
          input_text: r.input_text,
          input_url: r.input_url,
          status: r.status,
          created_at: r.created_at,
          completed_at: r.completed_at,
          claim_units_count: r.claim_units_count,
          sources_count: r.sources_count,
          findings_count: r.findings_count,
          status_counts: statusCounts,
        };
      });

      sendJson(200, {
        total: items.length,
        limit,
        investigations: items,
      });
      return;
    }

    // 3. Create investigation
    if (req.method === 'POST' && pathname === '/api/investigations') {
      const payload = await readBody();
      const claim = (payload.claim || '').trim();
      const sourceUrl = (payload.source_url || '').trim() || null;

      if (!claim || claim.length < 12) {
        sendJson(400, { detail: 'Please provide a verifiable claim with at least 12 characters.' });
        return;
      }

      if (!TINYFISH_KEY) {
        sendJson(503, {
          detail: 'TinyFish API is not configured. Live web research requires TINYFISH_API_KEY in backend/.env.',
        });
        return;
      }

      console.log(`[ProofTrail Engine] Initiating live investigation: "${claim.slice(0, 60)}..."`);
      const report = await runInvestigation(claim, sourceUrl);
      console.log(`[ProofTrail Engine] Investigation ${report.investigation_id} completed: ${report.sources.length} sources crawled.`);
      sendJson(200, report);
      return;
    }

    // 4. Get Report
    const reportMatch = pathname.match(/^\/api\/investigations\/([^/]+)\/report$/);
    if (req.method === 'GET' && reportMatch) {
      const invId = reportMatch[1];
      const row = db.prepare('SELECT report_json FROM investigations WHERE id = ?').get(invId);
      if (!row || !row.report_json) {
        sendJson(404, { detail: 'Investigation report not found.' });
        return;
      }
      sendJson(200, JSON.parse(row.report_json));
      return;
    }

    // 5. Get Metadata
    const metaMatch = pathname.match(/^\/api\/investigations\/([^/]+)$/);
    if (req.method === 'GET' && metaMatch) {
      const invId = metaMatch[1];
      const row = db.prepare('SELECT * FROM investigations WHERE id = ?').get(invId);
      if (!row) {
        sendJson(404, { detail: 'Investigation not found.' });
        return;
      }
      sendJson(200, {
        id: row.id,
        input_text: row.input_text,
        input_url: row.input_url,
        status: row.status,
        created_at: row.created_at,
        completed_at: row.completed_at,
        claim_units_count: row.claim_units_count,
        sources_count: row.sources_count,
        findings_count: row.findings_count,
      });
      return;
    }

    // 6. Export report
    const exportMatch = pathname.match(/^\/api\/investigations\/([^/]+)\/export$/);
    if (req.method === 'GET' && exportMatch) {
      const invId = exportMatch[1];
      const format = parsedUrl.searchParams.get('format') || 'json';
      const row = db.prepare('SELECT report_json FROM investigations WHERE id = ?').get(invId);
      if (!row || !row.report_json) {
        sendJson(404, { detail: 'Investigation report not found.' });
        return;
      }

      const rep = JSON.parse(row.report_json);
      if (format === 'markdown') {
        const md = [
          `# PROOFTRAIL AI — Investigation Report`,
          `**ID**: \`${rep.investigation_id}\` | **Status**: \`${rep.status.toUpperCase()}\``,
          `**Checked At**: ${rep.checked_at}`,
          `**Original Claim**: "${rep.input_text}"`,
          '',
          `## Findings`,
          ...rep.findings.map(f => `- **Field ${f.claim_unit_id}**: \`${f.status}\` — ${f.rationale}`),
          '',
          `## Sources Crawled`,
          ...rep.sources.map(s => `- [${s.title}](${s.final_url}) (${s.publisher}) [${s.quality?.tier}]`),
        ].join('\n');

        res.writeHead(200, {
          'Content-Type': 'text/markdown',
          'Content-Disposition': `attachment; filename="prooftrail-${invId}.md"`,
        });
        res.end(md);
        return;
      }

      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="prooftrail-${invId}.json"`,
      });
      res.end(JSON.stringify(rep, null, 2));
      return;
    }

    // 7. Retry investigation
    const retryMatch = pathname.match(/^\/api\/investigations\/([^/]+)\/retry$/);
    if (req.method === 'POST' && retryMatch) {
      const invId = retryMatch[1];
      const row = db.prepare('SELECT input_text, input_url FROM investigations WHERE id = ?').get(invId);
      if (!row) {
        sendJson(404, { detail: 'Investigation not found to retry.' });
        return;
      }

      const report = await runInvestigation(row.input_text, row.input_url);
      report.retry_of = invId;
      sendJson(200, report);
      return;
    }

    sendJson(404, { detail: `Route not found: ${req.method} ${pathname}` });
  } catch (err) {
    console.error('[ProofTrail Engine] Request error:', err);
    sendJson(500, { detail: 'Internal server error while executing investigation.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`================================================================`);
  console.log(`  PROOFTRAIL AI - Evidence Investigation Engine (v0.4.0)`);
  console.log(`  Live API URL: http://localhost:${PORT}`);
  console.log(`  TinyFish Status: ${TINYFISH_KEY ? 'CONNECTED (Live Key Detected)' : 'UNCONFIGURED'}`);
  console.log(`================================================================`);
});
