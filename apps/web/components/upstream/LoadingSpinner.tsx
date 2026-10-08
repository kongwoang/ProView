// Adapted from OpenReview components/LoadingSpinner.js. AGPL-3.0-or-later.
export default function LoadingSpinner({
  text = 'Loading',
  inline = false,
}: {
  text?: string;
  inline?: boolean;
}) {
  return (
    <div
      className={`spinner-container ${inline ? 'spinner-inline' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="spinner" aria-hidden="true">
        <div className="rect1" />
        <div className="rect2" />
        <div className="rect3" />
        <div className="rect4" />
        <div className="rect5" />
      </div>
      <span>{text}</span>
    </div>
  );
}
