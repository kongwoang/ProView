// ProView adaptation of OpenReview app/layout.js; see ../NOTICE.md.
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SessionProvider } from '@/providers/session-provider';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'ProView', template: '%s · ProView' },
  description: 'A workspace for course projects, thoughtful peer review, and academic progress.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
