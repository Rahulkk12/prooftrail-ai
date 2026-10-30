import React from 'react';
import { Search, FileSearch, ArrowRight, Sparkles } from 'lucide-react';

export default function EmptyState({
  icon: Icon = FileSearch,
  title = 'No investigations found',
  description = 'Start your first claim investigation to discover and verify evidence across the live web.',
  actionLabel = 'New Investigation',
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
}) {
  return (
    <div className="empty-state-card">
      <div className="empty-icon-box">
        <Icon size={32} className="empty-icon" />
      </div>
      <h3 className="empty-title">{title}</h3>
      <p className="empty-description">{description}</p>
      <div className="empty-actions">
        {onAction && (
          <button type="button" className="btn-primary" onClick={onAction}>
            <span>{actionLabel}</span>
            <ArrowRight size={14} />
          </button>
        )}
        {onSecondaryAction && (
          <button type="button" className="btn-secondary" onClick={onSecondaryAction}>
            <Sparkles size={14} />
            <span>{secondaryActionLabel}</span>
          </button>
        )}
      </div>
    </div>
  );
}
