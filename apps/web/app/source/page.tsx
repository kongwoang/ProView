import Link from 'next/link';

export default function SourcePage() {
  return (
    <main className="legal-page">
      <Link href="/dashboard">← Back to workspace</Link>
      <h1>Source &amp; acknowledgments</h1>
      <p id="upstream">
        ProView is a course-project review workspace. Its frontend is derived from the official
        OpenReview Web application.
      </p>
      <p id="license">
        Copyright © 2019–2026 OpenReview. The frontend is available under the GNU Affero General
        Public License, version 3 or later.
      </p>
      <p>
        <a href="https://github.com/kongwoang/ProView">ProView corresponding source</a> ·{' '}
        <a href="https://github.com/kongwoang/ProView/blob/main/apps/web/LICENSE.md">
          AGPL license
        </a>{' '}
        ·{' '}
        <a href="https://github.com/openreview/openreview-web/tree/3548cc359a3c8e3048112d10de39f45c1f0e7cc9">
          Pinned upstream source
        </a>
      </p>
      <p>
        The source includes the ProView modifications and upstream attribution. Operators who modify
        this application must offer the corresponding source for their deployed version.
      </p>
      <p>
        The ProView logo and wordmark follow the project team’s branding. Montserrat is used under
        the <a href="/brand/Montserrat-OFL.txt">SIL Open Font License, version 1.1</a>. The
        interface uses self-hosted Noto Sans under the{' '}
        <a href="/fonts/NotoSans-OFL.txt">same license</a>.
      </p>
    </main>
  );
}
