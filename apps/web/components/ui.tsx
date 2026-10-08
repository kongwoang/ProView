'use client';

import { cloneElement, isValidElement, useId, type ReactNode } from 'react';
import { ApiError } from '@/lib/api/client';
import Alert from './upstream/Alert';

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="muted">{description}</p>}
      </div>
      {actions && <div className="button-row">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        ◇
      </span>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ error, retry }: { error: unknown; retry?: () => void }) {
  const message =
    error instanceof ApiError ? error.message : 'Something went wrong. Please try again.';
  const conflict = error instanceof ApiError && error.status === 409;
  return (
    <Alert color="error">
      <div>
        <strong>{conflict ? 'This content has changed' : 'Unable to complete this request'}</strong>
        <p>{message}</p>
        {conflict && (
          <>
            <p>
              Your changes have not been saved. Copy any unsaved text before loading the latest
              version.
            </p>
            <button
              className="button secondary"
              onClick={() => {
                if (window.confirm('Reload this page and discard unsaved edits?'))
                  window.location.reload();
              }}
            >
              Load latest version
            </button>
          </>
        )}
        {retry && (
          <button className="button secondary" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    </Alert>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`status-badge status-${status.toLowerCase().replaceAll('_', '-')}`}>
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export function Section({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="section-heading">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}

export function Field({
  label,
  children,
  help,
}: {
  label: string;
  children: ReactNode;
  help?: string;
}) {
  const generatedId = useId();
  const id = isValidElement<{ id?: string }>(children)
    ? (children.props.id ?? generatedId)
    : generatedId;
  const control = isValidElement<{ id?: string }>(children)
    ? cloneElement(children, { id })
    : children;
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {control}
      {help && <small className="muted">{help}</small>}
    </div>
  );
}
