import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export default function Toast({ message, type = 'error', onClose, duration = 6000 }) {
  useEffect(() => {
    if (!duration || !onClose) return;
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  if (!message) return null;

  const icons = {
    error: <AlertCircle size={16} className="text-rose" />,
    success: <CheckCircle2 size={16} className="text-emerald" />,
    info: <Info size={16} className="text-accent" />,
  };

  return (
    <div className={`toast-notification toast-${type}`} role="alert">
      <div className="toast-icon-wrap">{icons[type] || icons.info}</div>
      <div className="toast-body">
        <span className="toast-text">{message}</span>
      </div>
      {onClose && (
        <button type="button" className="toast-close-btn" onClick={onClose} aria-label="Dismiss notification">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
