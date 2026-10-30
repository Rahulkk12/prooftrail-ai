import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import LandingPage from './pages/LandingPage';
import DashboardPage from './pages/DashboardPage';
import NewInvestigationPage from './pages/NewInvestigationPage';
import ProgressPage from './pages/ProgressPage';
import ReportPage from './pages/ReportPage';
import HistoryPage from './pages/HistoryPage';
import { checkHealth, createInvestigation, getReport, retryInvestigation } from './api/client';
import { EXAMPLE_INVESTIGATION_REPORTS } from './data/exampleReports';

export default function App() {
  const [currentRoute, setCurrentRoute] = useState('landing'); // 'landing', 'dashboard', 'new', 'progress', 'report', 'history'
  const [health, setHealth] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [inFlightClaim, setInFlightClaim] = useState('');
  const [inFlightUrl, setInFlightUrl] = useState('');
  const [progressError, setProgressError] = useState('');
  const [toast, setToast] = useState(null); // { message, type }

  // Check health on mount and every 30s
  useEffect(() => {
    const doCheck = async () => {
      const res = await checkHealth();
      setHealth(res);
    };
    doCheck();
    const interval = setInterval(doCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  // Start new live investigation
  const handleStartInvestigation = async (claim, sourceUrl = null) => {
    setInFlightClaim(claim);
    setInFlightUrl(sourceUrl || '');
    setProgressError('');
    setIsRunning(true);
    setCurrentRoute('progress');

    try {
      const report = await createInvestigation(claim, sourceUrl);
      setActiveReport(report);
      setIsRunning(false);
      setCurrentRoute('report');
      showToast('Investigation completed and evidence compiled into audit ledger.', 'success');
    } catch (err) {
      setIsRunning(false);
      const msg = err.message || 'Investigation could not be completed';
      setProgressError(msg);
      showToast(msg, 'error');
    }
  };

  // Select an investigation to view
  const handleSelectReport = async (investigationId) => {
    // Check if it's already active
    if (activeReport && activeReport.investigation_id === investigationId) {
      setCurrentRoute('report');
      return;
    }

    // Check if it matches a demo report
    const demo = EXAMPLE_INVESTIGATION_REPORTS.find((x) => x.investigation_id === investigationId);
    if (demo) {
      setActiveReport(demo);
      setCurrentRoute('report');
      return;
    }

    try {
      showToast('Loading investigation report...', 'info');
      const report = await getReport(investigationId);
      setActiveReport(report);
      setCurrentRoute('report');
    } catch (err) {
      showToast(err.message || 'Could not load report', 'error');
    }
  };

  // Retry an investigation
  const handleRetryInvestigation = async (investigationId) => {
    // If it's a demo, load the original claim
    const demo = EXAMPLE_INVESTIGATION_REPORTS.find((x) => x.investigation_id === investigationId);
    if (demo) {
      handleStartInvestigation(demo.input_text, demo.input_url);
      return;
    }

    setIsRunning(true);
    setProgressError('');
    setCurrentRoute('progress');

    try {
      showToast('Initiating auditable retry run...', 'info');
      const report = await retryInvestigation(investigationId);
      setActiveReport(report);
      setIsRunning(false);
      setCurrentRoute('report');
      showToast('Retry investigation completed.', 'success');
    } catch (err) {
      setIsRunning(false);
      // Fallback: if retry endpoint fails, try starting from report claim
      if (activeReport && activeReport.input_text) {
        handleStartInvestigation(activeReport.input_text, activeReport.input_url);
      } else {
        setProgressError(err.message || 'Retry failed');
        showToast(err.message || 'Retry failed', 'error');
      }
    }
  };

  // Load a demo example report
  const handleLoadExample = (exampleReport) => {
    setActiveReport(exampleReport);
    setCurrentRoute('report');
    showToast(`Loaded benchmark demonstration: ${exampleReport.investigation_id}`, 'info');
  };

  const isWorkspace = currentRoute !== 'landing';

  return (
    <div className="prooftrail-app-root">
      {/* Top Navigation */}
      <Navbar
        currentRoute={currentRoute}
        onNavigate={setCurrentRoute}
        health={health}
      />

      {/* Main Content Area */}
      {isWorkspace ? (
        <div className="workspace-layout">
          <Sidebar
            currentRoute={currentRoute}
            onNavigate={setCurrentRoute}
            health={health}
            isRunning={isRunning}
            activeReportId={activeReport?.investigation_id}
          />
          <main className="workspace-main-content">
            {currentRoute === 'dashboard' && (
              <DashboardPage
                onNavigate={setCurrentRoute}
                onSelectReport={handleSelectReport}
                onStartInvestigation={handleStartInvestigation}
                onLoadExample={handleLoadExample}
              />
            )}
            {currentRoute === 'new' && (
              <NewInvestigationPage
                onNavigate={setCurrentRoute}
                onStartInvestigation={handleStartInvestigation}
                isSubmitting={isRunning}
              />
            )}
            {currentRoute === 'progress' && (
              <ProgressPage
                claim={inFlightClaim}
                sourceUrl={inFlightUrl}
                isRunning={isRunning}
                error={progressError}
                onRetry={() => handleStartInvestigation(inFlightClaim, inFlightUrl)}
                onCancel={() => setCurrentRoute('new')}
              />
            )}
            {currentRoute === 'report' && (
              <ReportPage
                report={activeReport}
                onNavigate={setCurrentRoute}
                onRetry={handleRetryInvestigation}
                isRetrying={isRunning}
              />
            )}
            {currentRoute === 'history' && (
              <HistoryPage
                onNavigate={setCurrentRoute}
                onSelectReport={handleSelectReport}
                onRetry={handleRetryInvestigation}
                onLoadExample={handleLoadExample}
              />
            )}
          </main>
        </div>
      ) : (
        <main className="landing-main-content">
          <LandingPage
            onNavigate={setCurrentRoute}
            onStartInvestigation={handleStartInvestigation}
            onLoadExample={handleLoadExample}
          />
        </main>
      )}

      {/* Global Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
