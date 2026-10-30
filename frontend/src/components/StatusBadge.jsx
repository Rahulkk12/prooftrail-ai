import React from 'react';
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle, Check, AlertCircle, Clock } from 'lucide-react';

const STATUS_CONFIG = {
  SUPPORTED: {
    label: 'Supported',
    icon: CheckCircle2,
    className: 'badge-supported',
    description: 'Directly supported by verified source passages',
  },
  CONTRADICTED: {
    label: 'Contradicted',
    icon: XCircle,
    className: 'badge-contradicted',
    description: 'Directly contradicted by credible retrieved evidence',
  },
  MIXED: {
    label: 'Mixed Evidence',
    icon: AlertTriangle,
    className: 'badge-mixed',
    description: 'Conflicting credible evidence found across sources',
  },
  UNVERIFIED: {
    label: 'Unverified',
    icon: HelpCircle,
    className: 'badge-unverified',
    description: 'Insufficient public evidence to verify or refute',
  },
  // Overall investigation statuses
  completed: {
    label: 'Fully Verified',
    icon: Check,
    className: 'badge-supported',
    description: 'All claim fields have verified evidence',
  },
  completed_with_gaps: {
    label: 'Verified With Gaps',
    icon: AlertCircle,
    className: 'badge-mixed',
    description: 'Completed, but some fields or limitations remain unverified',
  },
  failed: {
    label: 'Run Incomplete',
    icon: XCircle,
    className: 'badge-contradicted',
    description: 'Investigation could not complete',
  },
  running: {
    label: 'Investigating',
    icon: Clock,
    className: 'badge-running',
    description: 'Evidence pipeline is currently running',
  },
};

export default function StatusBadge({ status, size = 'md', showIcon = true, pulse = false, className = '' }) {
  const normStatus = (status || 'UNVERIFIED').toUpperCase();
  const config = STATUS_CONFIG[normStatus] || STATUS_CONFIG[status] || STATUS_CONFIG.UNVERIFIED;
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg',
  };

  return (
    <span
      className={`status-badge ${config.className} ${sizeClasses[size] || 'badge-md'} ${pulse ? 'badge-pulse' : ''} ${className}`}
      title={config.description}
    >
      {showIcon && <Icon size={size === 'sm' ? 12 : size === 'lg' ? 16 : 14} className="badge-icon" />}
      <span className="badge-text">{config.label}</span>
    </span>
  );
}
