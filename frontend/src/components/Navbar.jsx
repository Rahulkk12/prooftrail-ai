import React, { useState } from 'react';
import {
  Fingerprint,
  LayoutDashboard,
  PlusCircle,
  History,
  ArrowUpRight,
  Menu,
  X,
  ShieldCheck,
  Globe2,
  Server
} from 'lucide-react';

export default function Navbar({ currentRoute, onNavigate, health }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNav = (route) => {
    onNavigate(route);
    setMobileMenuOpen(false);
  };

  const isOnline = health?.connected && health?.status === 'ok';

  return (
    <header className="navbar-container">
      <div className="navbar-inner">
        {/* Brand / Logo */}
        <div className="navbar-brand-group">
          <button
            type="button"
            className="navbar-brand"
            onClick={() => handleNav('landing')}
            title="ProofTrail AI — Home"
          >
            <span className="brand-logo-icon">
              <Fingerprint size={20} />
            </span>
            <span className="brand-title">
              PROOFTRAIL <strong className="brand-highlight">AI</strong>
            </span>
          </button>
          <span className="brand-version-tag">v0.1.0</span>
        </div>

        {/* Desktop Nav Links */}
        <nav className="navbar-desktop-links" aria-label="Main Navigation">
          <button
            type="button"
            className={`nav-link ${currentRoute === 'landing' ? 'active' : ''}`}
            onClick={() => handleNav('landing')}
          >
            Overview
          </button>
          <button
            type="button"
            className={`nav-link ${currentRoute === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNav('dashboard')}
          >
            <LayoutDashboard size={14} />
            <span>Dashboard</span>
          </button>
          <button
            type="button"
            className={`nav-link ${currentRoute === 'new' ? 'active' : ''}`}
            onClick={() => handleNav('new')}
          >
            <PlusCircle size={14} />
            <span>New Investigation</span>
          </button>
          <button
            type="button"
            className={`nav-link ${currentRoute === 'history' ? 'active' : ''}`}
            onClick={() => handleNav('history')}
          >
            <History size={14} />
            <span>Audit History</span>
          </button>
        </nav>

        {/* Navbar Right Actions */}
        <div className="navbar-right-actions">
          {/* Health indicator */}
          <div className="system-health-pill" title={isOnline ? 'FastAPI & SQLite backend operational' : 'Backend offline or unreachable'}>
            <span className={`status-dot ${isOnline ? 'dot-online' : 'dot-offline'}`} />
            <span className="health-label">
              {isOnline ? 'SYSTEM OPERATIONAL' : 'SYSTEM OFFLINE'}
            </span>
          </div>

          {/* GitHub Link */}
          <a
            href="https://github.com/Rahulkk12/prooftrail-ai"
            target="_blank"
            rel="noopener noreferrer"
            className="navbar-github-btn"
            title="View open source repository on GitHub"
          >
            <span>GitHub</span>
            <ArrowUpRight size={13} />
          </a>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            className="navbar-mobile-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="navbar-mobile-drawer">
          <nav className="mobile-nav-links">
            <button
              type="button"
              className={`mobile-nav-item ${currentRoute === 'landing' ? 'active' : ''}`}
              onClick={() => handleNav('landing')}
            >
              Overview
            </button>
            <button
              type="button"
              className={`mobile-nav-item ${currentRoute === 'dashboard' ? 'active' : ''}`}
              onClick={() => handleNav('dashboard')}
            >
              <LayoutDashboard size={16} />
              <span>Dashboard</span>
            </button>
            <button
              type="button"
              className={`mobile-nav-item ${currentRoute === 'new' ? 'active' : ''}`}
              onClick={() => handleNav('new')}
            >
              <PlusCircle size={16} />
              <span>New Investigation</span>
            </button>
            <button
              type="button"
              className={`mobile-nav-item ${currentRoute === 'history' ? 'active' : ''}`}
              onClick={() => handleNav('history')}
            >
              <History size={16} />
              <span>Audit History</span>
            </button>
          </nav>
        </div>
      )}
    </header>
  );
}
