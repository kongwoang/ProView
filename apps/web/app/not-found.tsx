import Link from 'next/link';
export default function NotFound() {
  return (
    <main className="legal-page">
      <p className="eyebrow">404 · PAGE NOT FOUND</p>
      <h1>This page is not part of your workspace.</h1>
      <p>The link may have changed, or the resource may no longer be available.</p>
      <Link className="button" href="/dashboard">
        Go to overview
      </Link>
    </main>
  );
}
