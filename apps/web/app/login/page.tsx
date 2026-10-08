'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/providers/session-provider';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import { ErrorState, Field } from '@/components/ui';
import { ProViewBrand } from '@/components/proview-brand';

export default function LoginPage() {
  const { user, loading, login } = useSession();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => {
    if (user) router.replace('/dashboard');
  }, [user, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await login(String(form.get('identifier')), String(form.get('password')));
      router.replace('/dashboard');
    } catch (cause) {
      setError(cause);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="login-page">
      <header className="site-header">
        <div className="topbar">
          <Link className="brand" href="/" aria-label="ProView home">
            <ProViewBrand />
          </Link>
          <span className="muted">Course projects and peer review</span>
        </div>
        <div className="navigation-bar">
          <div className="navigation-inner">
            <span className="login-context">Sign in to your academic workspace</span>
          </div>
        </div>
      </header>
      <main id="main-content" className="login-content">
        <section className="login-form-wrap" aria-labelledby="login-heading">
          <h1 id="login-heading">Login</h1>
          {error ? <ErrorState error={error} /> : null}
          <form onSubmit={(event) => void handleSubmit(event)} className="form-stack">
            <Field label="Email or username">
              <input
                name="identifier"
                autoComplete="username"
                required
                autoFocus
                disabled={pending}
                placeholder="Your email or username"
              />
            </Field>
            <Field label="Password">
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={pending}
                placeholder="Enter your password"
              />
            </Field>
            <div className="button-row">
              <SpinnerButton type="submit" loading={pending} disabled={loading || !!user}>
                Sign in
              </SpinnerButton>
            </div>
          </form>
          <p className="login-help">Need a password reset? Contact your course administrator.</p>
        </section>
        <section className="login-access" aria-labelledby="access-heading">
          <h2 id="access-heading">New to ProView?</h2>
          <p>Your administrator creates your account and your instructor adds you to a course.</p>
          <p>
            Once signed in, you can find your project group, submit PDF versions, review assigned
            projects and respond to feedback.
          </p>
          <p className="muted">Contact your course administrator if you need access.</p>
        </section>
      </main>
      <footer className="workspace-footer">
        <span>ProView · Course projects and peer review</span>
        <Link href="/source">Source &amp; acknowledgments</Link>
      </footer>
    </div>
  );
}
