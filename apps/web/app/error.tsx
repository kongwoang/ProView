'use client';
import { ErrorState } from '@/components/ui';
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="legal-page">
      <ErrorState error={new Error()} retry={reset} />
    </main>
  );
}
