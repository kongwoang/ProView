'use client';

// Adapted from OpenReview components/Alert.js. AGPL-3.0-or-later.
import { useState, type ReactNode } from 'react';

export default function Alert({
  color = 'info',
  dismissible = false,
  children,
}: {
  color?: 'info' | 'error' | 'success' | 'warning';
  dismissible?: boolean;
  children: ReactNode;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className={`alert alert-${color}`} role={color === 'error' ? 'alert' : 'status'}>
      {children}
      {dismissible && (
        <button
          type="button"
          className="icon-button"
          aria-label="Dismiss message"
          onClick={() => setDismissed(true)}
        >
          ×
        </button>
      )}
    </div>
  );
}
