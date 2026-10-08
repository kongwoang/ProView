// Adapted from OpenReview components/SpinnerButton.js. AGPL-3.0-or-later.
import type { ButtonHTMLAttributes } from 'react';

export default function SpinnerButton({
  loading,
  disabled,
  children,
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      {...props}
      type={type}
      className={`button ${className}`}
      disabled={disabled || loading}
      aria-busy={loading}
    >
      {children}
      {loading && (
        <span className="spinner-small" aria-hidden="true">
          <span className="rect1" />
          <span className="rect2" />
          <span className="rect3" />
          <span className="rect4" />
        </span>
      )}
    </button>
  );
}
