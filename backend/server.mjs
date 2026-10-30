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

console.log(`[ProofTrail Engine] SQLite database ready at ${dbPath}`);

// In-memory cache for fetched pages
const pageCache = new Map();

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

// Extract exact verbatim substring with highest semantic relevance
function extractExactPassage(sourceText, claimText) {
  if (!sourceText || typeof sourceText !== 'string' || !claimText) return null;

  const stopWords = new Set(['this', 'that', 'with', 'from', 'into', 'have', 'were', 'been', 'will', 'some', 'what', 'when', 'then', 'about', 'more', 'there']);
  const keywords = claimText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && !stopWords.has(w));

  if (keywords.length === 0) return null;

  const rawSentences = sourceText
    .split(/(?<=[.!?\n])\s+/)
    .map(s => s.trim())
    .filter(s => s.length >= 25 && s.length <= 450);

  let bestSentence = null;
  let bestScore = 0;

  for (const sent of rawSentences) {
    const sentLow = sent.toLowerCase();
    let matches = 0;
    for (const kw of keywords) {
      if (sentLow.includes(kw)) matches++;
    }
    const score = matches / keywords.length;
    if (score > bestScore && score >= 0.35) {
      bestScore = score;
      bestSentence = sent;
    }
  }

  if (bestSentence && sourceText.includes(bestSentence)) {
    return bestSentence;
  }
  return null;
}

// TinyFish Search with automated retry
async function tinyfishSearchSingle(query) {
  if (!TINYFISH_KEY) {
    throw new Error('TINYFISH_API_KEY is not configured in backend/.env.');
  }

  const cleanQuery = query.trim();
  const searchUrl = new URL(TINYFISH_SEARCH_BASE);
  searchUrl.searchParams.set('query', cleanQuery);
  searchUrl.searchParams.set('location', 'IN');
  searchUrl.searchParams.set('language', 'en');

  const headers = {
    'X-API-Key': TINYFISH_KEY,
    'Accept': 'application/json',
    'User-Agent': 'ProofTrail-AI/0.4.0',
  };

  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(searchUrl.toString(), { method: 'GET', headers });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`TinyFish Search HTTP ${res.status}: ${text.slice(0, 140)}`);
      }

      const data = await res.json();
      const rawList = data.results || data.items || (Array.isArray(data) ? data : []);
      const normalized = [];

      for (const item of rawList) {
        const u = item.url || item.link;
        if (u && isSafePublicUrl(u)) {
          normalized.push({
            url: u,
            title: item.title || item.name || u,
            snippet: item.snippet || item.description || '',
            publisher: item.site_name || item.publisher || new URL(u).hostname,
            date: item.published_date || item.date || null,
          });
        }
      }
      return normalized;
    } catch (err) {
      lastErr = err;
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  throw lastErr || new Error('TinyFish Search connection failed after retries.');
}

// Multi-tier query expansion
async function multiTierTinyFishSearch(claim) {
  const words = claim.trim().split(/\s+/);
  const stopWords = new Set(['this', 'that', 'with', 'from', 'into', 'have', 'were', 'been', 'will', 'some', 'what', 'when']);
  const coreWords = words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));

  const queries = [claim.slice(0, 250)];
  if (coreWords.length >= 2) {
    queries.push(`${coreWords.slice(0, 4).join(' ')} news report`);
  }
  if (coreWords.length >= 3) {
    queries.push(`${coreWords.slice(0, 3).join(' ')} fact check verified`);
  }

  const allResults = [];
  const seenUrls = new Set();

  for (const q of queries.slice(0, 2)) {
    try {
      const res = await tinyfishSearchSingle(q);
      for (const item of res) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url);
          allResults.push(item);
        }
      }
      if (allResults.length >= 8) break;
    } catch (e) {
      console.warn(`[Search Warning] Query "${q}" failed:`, e.message);
    }
  }

  return allResults.slice(0, 8);
}

// TinyFish Fetch
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

  let fetched = [];
  let rawErrors = [];

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(TINYFISH_FETCH_BASE, {
        method: 'POST',
        headers,
        body: JSON.stringify({ urls: uncached }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        rawErrors.push({ url: 'batch', error: `TinyFish Fetch HTTP ${res.status}: ${errText.slice(0, 160)}` });
        break;
      }

      const data = await res.json();
      const rawPages = data.results || data.pages || (Array.isArray(data) ? data : []);
      rawErrors = data.errors || [];

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
      break;
    } catch (err) {
      if (attempt === 2) {
        rawErrors.push({ url: 'batch', error: err.message });
      }
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  return {
    pages: [...cached, ...fetched],
    errors: Array.isArray(rawErrors) ? rawErrors : [],
  };
}

// Decompose claim
function decomposeClaim(claimText) {
  const units = [];
  let idCounter = 0;

  units.push({
    id: `claim_unit_${idCounter++}`,
    category: 'PRIMARY_CLAIM',
    field_name: 'Core Claim Assertion',
    claim_text: claimText.trim(),
    verification_question: `Does authenticated reporting confirm: "${claimText.trim()}"?`,
  });

  const words = claimText.split(/\s+/);
  const stopWords = new Set(['this', 'that', 'with', 'from', 'into', 'have', 'were', 'been', 'will', 'some', 'what', 'when']);
  const keywords = words.filter(w => w.length > 3 && !stopWords.has(w.toLowerCase()));

  if (keywords.length >= 2) {
    const subject = keywords.slice(0, 3).join(' ');
    units.push({
      id: `claim_unit_${idCounter++}`,
      category: 'EVENT_SUBJECT',
      field_name: 'Subject Entity & Event Corroboration',
      claim_text: `Incident involving: ${subject}`,
      verification_question: `What official press releases or news reports verify ${subject}?`,
    });
  }

  return units;
}

// Investigation Engine
async function runInvestigation(claim, sourceUrl) {
  const invId = `inv_${crypto.randomBytes(6).toString('hex')}`;
  const created = nowIso();
  const limitations = [];

  const claimUnits = decomposeClaim(claim);

  let searchResults = [];
  try {
    searchResults = await multiTierTinyFishSearch(claim);
  } catch (err) {
    limitations.push(`TinyFish Search query error: ${err.message}`);
  }

  const candidateUrls = [];
  if (sourceUrl && isSafePublicUrl(sourceUrl)) {
    candidateUrls.push(sourceUrl);
  }
  for (const item of searchResults) {
    if (item.url && isSafePublicUrl(item.url)) {
      candidateUrls.push(item.url);
    }
  }

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

  const sources = fetchedPages.map((page) => {
    const matchingSearch = searchResults.find(s => s.url === page.url) || {};
    const domain = new URL(page.final_url || page.url).hostname.toLowerCase();
    const isGov = domain.endsWith('.gov') || domain.endsWith('.gov.in') || domain.endsWith('.nic.in');
    const isNews = domain.includes('news') || domain.includes('times') || domain.includes('hindu') || domain.includes('express') || domain.includes('ndtv') || domain.includes('today');

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

        if (
          pLower.includes('fire') || pLower.includes('incident') ||
          pLower.includes('broke out') || pLower.includes('reported') ||
          pLower.includes('confirmed') || pLower.includes('scholarship') ||
          pLower.includes('sanction') || pLower.includes('approved') ||
          pLower.includes('arrest') || pLower.includes('probe')
        ) {
          relation = 'SUPPORTS';
          hasSupport = true;
        } else if (
          pLower.includes('fake') || pLower.includes('denied') ||
          pLower.includes('false') || pLower.includes('hoax') ||
          pLower.includes('untrue') || pLower.includes('dismissed') ||
          pLower.includes('refuted') || pLower.includes('misleading')
        ) {
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
          bestRationale = `Verified by exact reportage in ${src.publisher}: "${passage.slice(0, 140)}..."`;
        } else if (!bestRationale && relation === 'CONTRADICTS') {
          bestRationale = `Directly contradicted by report in ${src.publisher}: "${passage.slice(0, 140)}..."`;
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

// 4. OpenAPI 3.0 Specification
const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "PROOFTRAIL AI - Evidence Investigation API",
    description: "Production API for TinyFish-powered real-time web evidence investigations, exact substring verification, and audit ledgers.",
    version: "0.4.0",
    contact: {
      name: "ProofTrail AI Support",
      url: "https://github.com/Rahulkk12/prooftrail-ai"
    }
  },
  servers: [
    {
      url: "http://localhost:8000",
      description: "Local Investigation Engine"
    }
  ],
  paths: {
    "/api/health": {
      get: {
        summary: "System Health & TinyFish Status",
        description: "Returns health status, active database mode, and whether TinyFish API key is authenticated.",
        tags: ["Health & System"],
        responses: {
          "200": {
            description: "System is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    version: { type: "string", example: "0.4.0" },
                    timestamp: { type: "string" },
                    tinyfish_configured: { type: "boolean", example: true },
                    llm_configured: { type: "boolean", example: false },
                    database: { type: "string", example: "sqlite" },
                    cache_entries: { type: "integer", example: 8 },
                    policy: { type: "string", example: "real_data_only" }
                  }
                }
              }
            }
          }
        }
      }
    },
    "/api/investigations": {
      get: {
        summary: "List Audit Ledger Investigations",
        description: "Retrieves a paginated list of all investigations conducted in this workspace.",
        tags: ["Investigations"],
        parameters: [
          {
            name: "limit",
            in: "query",
            description: "Number of investigations to return (default 50)",
            schema: { type: "integer", default: 50 }
          }
        ],
        responses: {
          "200": {
            description: "List of investigations",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer", example: 3 },
                    limit: { type: "integer", example: 50 },
                    investigations: { type: "array" }
                  }
                }
              }
            }
          }
        }
      },
      post: {
        summary: "Create & Execute Live Web Investigation",
        description: "Accepts a factual claim statement, decomposes it into atomic fields, executes live TinyFish Search & Fetch, and returns a verified evidence report.",
        tags: ["Investigations"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["claim"],
                properties: {
                  claim: {
                    type: "string",
                    description: "The claim statement to investigate (min 12 characters)",
                    example: "presidency got into fire"
                  },
                  source_url: {
                    type: "string",
                    description: "Optional reference URL to prioritize during research",
                    example: "https://timesofindia.indiatimes.com"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Investigation completed successfully with evidence ledger",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    investigation_id: { type: "string", example: "inv_93364a5aff29" },
                    status: { type: "string", enum: ["completed", "completed_with_gaps", "failed"] },
                    input_text: { type: "string", example: "presidency got into fire" },
                    sources: { type: "array" },
                    findings: { type: "array" },
                    evidence: { type: "array" }
                  }
                }
              }
            }
          },
          "400": { description: "Invalid claim input (less than 12 characters)" },
          "503": { description: "TinyFish API key not configured" }
        }
      }
    },
    "/api/investigations/{id}/report": {
      get: {
        summary: "Get Investigation Full Report",
        description: "Retrieves complete audit report JSON including exact quotations, citations, and evidence ledger.",
        tags: ["Reports & Export"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", example: "inv_93364a5aff29" }
          }
        ],
        responses: {
          "200": { description: "Full structured report JSON" },
          "404": { description: "Report not found" }
        }
      }
    },
    "/api/investigations/{id}/export": {
      get: {
        summary: "Export Investigation Report",
        description: "Export the completed investigation report as structured JSON or executive Markdown.",
        tags: ["Reports & Export"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", example: "inv_93364a5aff29" }
          },
          {
            name: "format",
            in: "query",
            schema: { type: "string", enum: ["json", "markdown"], default: "json" }
          }
        ],
        responses: {
          "200": { description: "Downloadable report" }
        }
      }
    },
    "/api/investigations/{id}/retry": {
      post: {
        summary: "Retry Investigation Run",
        description: "Initiates a new auditable investigation run using original inputs, linking back to earlier ID.",
        tags: ["Investigations"],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string", example: "inv_93364a5aff29" }
          }
        ],
        responses: {
          "200": { description: "New completed investigation report" }
        }
      }
    }
  }
};

// Swagger UI HTML Page
const swaggerUiHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>PROOFTRAIL AI — Interactive Swagger API</title>
  <link rel="stylesheet" type="text/css" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <link rel="icon" type="image/png" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/favicon-32x32.png" />
  <style>
    body {
      margin: 0;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
    }
    .topbar-custom {
      background: #090d16;
      border-bottom: 2px solid #0284c7;
      padding: 14px 28px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    }
    .topbar-brand {
      font-size: 20px;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .topbar-brand span { color: #38bdf8; }
    .topbar-badge {
      background: #0369a1;
      color: #e0f2fe;
      font-size: 11px;
      padding: 3px 10px;
      border-radius: 999px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .nav-actions {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .frontend-link {
      background: #0284c7;
      color: #ffffff !important;
      padding: 8px 16px;
      border-radius: 6px;
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.2s;
    }
    .frontend-link:hover {
      background: #0369a1;
    }
    .swagger-container {
      background: #ffffff;
      min-height: calc(100vh - 65px);
    }
    .swagger-ui .topbar { display: none; }
    .swagger-ui {
      max-width: 1280px;
      margin: 0 auto;
      padding: 24px 20px 80px;
    }
    .swagger-ui .info { margin: 20px 0 32px; }
    .swagger-ui .info .title { font-size: 28px; color: #0f172a; font-weight: 800; }
    .swagger-ui .info p { font-size: 14px; color: #475569; line-height: 1.6; }
    .swagger-ui .scheme-container { background: #f8fafc; border-bottom: 1px solid #e2e8f0; padding: 15px 0; }
    .swagger-ui .opblock.opblock-post { border-color: #49cc90; background: rgba(73,204,144,.05); }
    .swagger-ui .opblock.opblock-get { border-color: #61affe; background: rgba(97,175,254,.05); }
    .swagger-ui .btn.execute { background-color: #0284c7; border-color: #0284c7; color: #fff; font-weight: 700; }
    .swagger-ui .btn.execute:hover { background-color: #0369a1; }
  </style>
</head>
<body>
  <div class="topbar-custom">
    <div class="topbar-brand">
      PROOFTRAIL <span>AI</span>
      <span class="topbar-badge">v0.4.0 Engine</span>
    </div>
    <div class="nav-actions">
      <span style="font-size: 13px; color: #94a3b8;">TinyFish Web Intelligence</span>
      <a href="http://localhost:5173" class="frontend-link" target="_blank" rel="noopener">Open Frontend Studio &rarr;</a>
    </div>
  </div>
  <div class="swagger-container">
    <div id="swagger-ui"></div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "/openapi.json",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout",
        docExpansion: "list",
        defaultModelsExpandDepth: 1
      });
    };
  </script>
</body>
</html>`;

// 5. HTTP API Server
const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, X-API-Key');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

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

  const sendJson = (statusCode, data) => {
    const jsonStr = JSON.stringify(data, null, 2);
    const buf = Buffer.from(jsonStr, 'utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Length', buf.length);
    res.writeHead(statusCode);
    res.end(buf);
  };

  try {
    // A. Root or Swagger aliases -> Swagger UI
    if (req.method === 'GET' && (pathname === '/' || pathname === '/docs' || pathname === '/docs/' || pathname === '/swagger' || pathname === '/swagger/')) {
      const buf = Buffer.from(swaggerUiHtml, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Length', buf.length);
      res.writeHead(200);
      res.end(buf);
      return;
    }

    // B. OpenAPI JSON Specification
    if (req.method === 'GET' && pathname === '/openapi.json') {
      sendJson(200, openApiSpec);
      return;
    }

    // 1. Health check
    if (req.method === 'GET' && pathname === '/api/health') {
      const healthData = {
        status: 'ok',
        version: '0.4.0',
        timestamp: nowIso(),
        tinyfish_configured: Boolean(TINYFISH_KEY && TINYFISH_KEY.length > 5),
        llm_configured: false,
        database: 'sqlite',
        cache_entries: pageCache.size,
        environment: 'development',
        policy: 'real_data_only',
      };

      const accept = (req.headers['accept'] || '').toLowerCase();
      // If a human opened this in a browser tab (text/html):
      if (accept.includes('text/html') && !accept.includes('application/json')) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ProofTrail AI — API Health</title>
  <style>
    body { background: #0b1120; color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 36px; max-width: 600px; width: 90%; box-shadow: 0 24px 48px rgba(0,0,0,0.6); }
    h1 { font-size: 22px; margin: 0 0 10px; color: #38bdf8; display: flex; align-items: center; justify-content: space-between; }
    p { color: #94a3b8; font-size: 14px; margin: 0 0 24px; line-height: 1.5; }
    .actions { display: flex; gap: 12px; margin-bottom: 24px; flex-wrap: wrap; }
    .btn { display: inline-flex; align-items: center; gap: 8px; background: #0284c7; color: white; padding: 12px 20px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; transition: background 0.15s; }
    .btn:hover { background: #0369a1; }
    .btn-secondary { background: #1e293b; border: 1px solid #334155; color: #cbd5e1; }
    .btn-secondary:hover { background: #334155; }
    pre { background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; color: #38bdf8; font-size: 13px; overflow-x: auto; margin: 0; font-family: ui-monospace, Menlo, Monaco, Consolas, monospace; }
    .badge { background: #065f46; color: #6ee7b7; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 999px; letter-spacing: 0.5px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>
      <span>PROOFTRAIL AI API</span>
      <span class="badge">ONLINE</span>
    </h1>
    <p>The backend investigation engine is online with live TinyFish integration ready to audit claims.</p>
    <div class="actions">
      <a href="/docs" class="btn">&#x26A1; Open Swagger UI Docs</a>
      <a href="http://localhost:5173" class="btn btn-secondary" target="_blank">&#x1F680; Open Frontend Studio</a>
    </div>
    <pre>${JSON.stringify(healthData, null, 2)}</pre>
  </div>
</body>
</html>`;
        const buf = Buffer.from(html, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Length', buf.length);
        res.writeHead(200);
        res.end(buf);
        return;
      }

      sendJson(200, healthData);
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

      console.log(`[ProofTrail Engine] Running live multi-tier investigation: "${claim.slice(0, 60)}..."`);
      const report = await runInvestigation(claim, sourceUrl);
      console.log(`[ProofTrail Engine] Investigation ${report.investigation_id} done (${report.sources.length} sources).`);
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

        const mdBuf = Buffer.from(md, 'utf8');
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        res.setHeader('Content-Length', mdBuf.length);
        res.setHeader('Content-Disposition', `attachment; filename="prooftrail-${invId}.md"`);
        res.writeHead(200);
        res.end(mdBuf);
        return;
      }

      sendJson(200, rep);
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
  console.log(`  Swagger UI Docs: http://localhost:${PORT}/docs`);
  console.log(`  Live API URL:    http://localhost:${PORT}`);
  console.log(`  TinyFish Status: ${TINYFISH_KEY ? 'CONNECTED (Live Key Detected)' : 'UNCONFIGURED'}`);
  console.log(`================================================================`);
});
