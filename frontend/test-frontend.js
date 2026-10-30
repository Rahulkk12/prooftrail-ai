import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Starting ProofTrail AI Frontend Test Suite...\n');

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

// 3. Verify Example Benchmark Reports
import { EXAMPLE_INVESTIGATION_REPORTS } from './src/data/exampleReports.js';
assert(Array.isArray(EXAMPLE_INVESTIGATION_REPORTS) && EXAMPLE_INVESTIGATION_REPORTS.length > 0, 'Example benchmark reports array exists');

const demo = EXAMPLE_INVESTIGATION_REPORTS[0];
assert(demo.investigation_id && demo.status && demo.claim_units && demo.sources && demo.findings, 'Benchmark report has complete structure');
const statuses = new Set(demo.findings.map(f => f.status));
assert(statuses.has('SUPPORTED') && statuses.has('CONTRADICTED') && statuses.has('UNVERIFIED'), 'Benchmark demonstrates Supported, Contradicted and Unverified statuses');

// 4. Verify Built Dist
const distHtml = path.join(__dirname, 'dist', 'index.html');
assert(fs.existsSync(distHtml), 'Vite production build output dist/index.html exists');

if (failed) {
  console.error('\n❌ Frontend verification failed with errors.');
  process.exit(1);
} else {
  console.log('\n🎉 All ProofTrail AI frontend verification tests passed successfully!');
}
