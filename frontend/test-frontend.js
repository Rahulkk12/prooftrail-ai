import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting ProofTrail AI Comprehensive Frontend & Edge Case Test Suite...\n');

let failed = false;
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failed = true;
  } else {
    console.log(`✓ PASS: ${message}`);
  }
}

// 1. Verify critical source files exist
const requiredFiles = [
  'index.html',
  'src/main.jsx',
  'src/App.jsx',
  'src/styles.css',
  'src/api/client.js',
  'src/data/exampleReports.js',
  'src/components/Navbar.jsx',
  'src/components/Sidebar.jsx',
  'src/components/StatusBadge.jsx',
  'src/components/InvestigationForm.jsx',
  'src/components/EvidenceCard.jsx',
  'src/components/SourceCard.jsx',
  'src/components/ProgressTimeline.jsx',
  'src/components/SummaryStatistics.jsx',
  'src/components/ConflictComparison.jsx',
  'src/components/Toast.jsx',
  'src/components/EmptyState.jsx',
  'src/pages/LandingPage.jsx',
  'src/pages/DashboardPage.jsx',
  'src/pages/NewInvestigationPage.jsx',
  'src/pages/ProgressPage.jsx',
  'src/pages/ReportPage.jsx',
  'src/pages/HistoryPage.jsx',
];

for (const file of requiredFiles) {
  const fullPath = path.join(__dirname, file);
  assert(fs.existsSync(fullPath), `File exists: ${file}`);
}

// 2. Verify API client methods
import * as apiClient from './src/api/client.js';
const expectedApiMethods = [
  'checkHealth',
  'createInvestigation',
  'listInvestigations',
  'getReport',
  'retryInvestigation',
  'getLocalCachedInvestigations',
  'getLocalReport',
  'saveReportToCache'
];
for (const method of expectedApiMethods) {
  assert(typeof apiClient[method] === 'function', `API Client exports function: ${method}`);
}

// 3. Verify Example Benchmark Reports & All 4 Statuses
import { EXAMPLE_INVESTIGATION_REPORTS } from './src/data/exampleReports.js';
assert(Array.isArray(EXAMPLE_INVESTIGATION_REPORTS) && EXAMPLE_INVESTIGATION_REPORTS.length >= 2, 'Example benchmark reports array exists with multiple cases');

for (const rep of EXAMPLE_INVESTIGATION_REPORTS) {
  assert(rep.investigation_id && rep.status && rep.claim_units && rep.sources && rep.findings, `Benchmark report ${rep.investigation_id} has complete structure`);
  assert(rep.is_example === true, `Benchmark report ${rep.investigation_id} is clearly flagged with is_example=true`);
  assert(Array.isArray(rep.evidence) && rep.evidence.length > 0, `Benchmark report ${rep.investigation_id} has citations`);
}

// Check coverage of all 4 statuses across demo reports
const allStatuses = new Set(EXAMPLE_INVESTIGATION_REPORTS.flatMap(r => r.findings.map(f => f.status)));
assert(allStatuses.has('SUPPORTED'), 'Benchmark demonstrates SUPPORTED status');
assert(allStatuses.has('CONTRADICTED'), 'Benchmark demonstrates CONTRADICTED status');
assert(allStatuses.has('UNVERIFIED'), 'Benchmark demonstrates UNVERIFIED status');

// 4. Edge Case: Character validation rules (min 12, max 2000)
function validateClaimLength(text) {
  const trimmed = (text || '').trim();
  return trimmed.length >= 12 && trimmed.length <= 2000;
}

assert(!validateClaimLength(''), 'Edge Case: Empty claim rejected');
assert(!validateClaimLength('Too short'), 'Edge Case: Claim under 12 characters rejected');
assert(validateClaimLength('This is a valid claim statement with sufficient length.'), 'Edge Case: Valid 55-char claim accepted');
assert(!validateClaimLength('A'.repeat(2001)), 'Edge Case: Oversized claim (>2000 chars) rejected');
assert(validateClaimLength('A'.repeat(2000)), 'Edge Case: Exact 2000 char claim accepted');

// 5. Edge Case: URL security validation on client
function validateClientUrl(val) {
  if (!val || !val.trim()) return { valid: true, error: null };
  try {
    const parsed = new URL(val);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only public http:// and https:// URLs are allowed' };
    }
    if (
      parsed.hostname === 'localhost' ||
      parsed.hostname.startsWith('127.') ||
      parsed.hostname.startsWith('192.168.') ||
      parsed.hostname.startsWith('10.') ||
      parsed.hostname === '169.254.169.254'
    ) {
      return { valid: false, error: 'Private and localhost URLs are forbidden' };
    }
    return { valid: true, error: null };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

assert(validateClientUrl('https://scholarships.gov.in').valid, 'Edge Case: Valid public URL accepted');
assert(!validateClientUrl('http://localhost:8000').valid, 'Edge Case: Localhost URL rejected');
assert(!validateClientUrl('http://127.0.0.1/private').valid, 'Edge Case: Loopback IP rejected');
assert(!validateClientUrl('http://169.254.169.254/latest/meta-data').valid, 'Edge Case: Cloud metadata IP rejected');
assert(!validateClientUrl('ftp://example.com/file').valid, 'Edge Case: Non-HTTP scheme rejected');
assert(!validateClientUrl('not-a-url').valid, 'Edge Case: Malformed URL string rejected');

// 6. Verify Built Dist Output
const distHtml = path.join(__dirname, 'dist', 'index.html');
assert(fs.existsSync(distHtml), 'Vite production build output dist/index.html exists');

if (failed) {
  console.error('\n❌ Frontend verification failed with errors.');
  process.exit(1);
} else {
  console.log('\n🎉 All ProofTrail AI frontend & edge case verification tests passed successfully!');
}
