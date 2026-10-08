import Link from 'next/link';

/** Footer structure adapted from OpenReview app/Footer.js (AGPL-3.0-or-later). */
export function WorkspaceFooter({ authenticated = false }: { authenticated?: boolean }) {
  return (
    <footer className="workspace-footer">
      <div className="footer-links">
        <Link href="/source">About ProView</Link>
        <Link href={authenticated ? '/profile' : '/login#access-heading'}>
          {authenticated ? 'Your profile' : 'Account access'}
        </Link>
        <Link href="/source">Source &amp; acknowledgments</Link>
        <a href="https://github.com/kongwoang/ProView">GitHub repository</a>
        <Link href="/source#license">License</Link>
        <Link href="/source#upstream">OpenReview credits</Link>
      </div>
      <div className="footer-notice">
        <p>ProView supports course projects, peer review and academic progress.</p>
        <p>
          Frontend derived from OpenReview ·{' '}
          <Link href="/source#license">Source &amp; license</Link>
        </p>
      </div>
    </footer>
  );
}
