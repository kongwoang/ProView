'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/providers/session-provider';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import { ErrorState, Field } from '@/components/ui';
import { ProViewBrand } from '@/components/proview-brand';
import { WorkspaceFooter } from '@/components/workspace-footer';

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
          <Link className="header-login" href="/login" aria-current="page">
            Login
          </Link>
        </div>
        <div className="navigation-bar">
          <div className="navigation-inner">
            <span className="login-context">
              Course Projects. Peer Review. Author Responses. Evaluation. Academic History.
            </span>
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
                Login to ProView
              </SpinnerButton>
            </div>
          </form>
          <p className="login-help">Need a password reset? Contact your course administrator.</p>
        </section>
        <section className="login-access" aria-labelledby="access-heading">
          <h2 id="access-heading">New user?</h2>
          <p>Contact your course administrator to request an account.</p>
          <p className="muted">Your instructor will enroll you in a course and project group.</p>
        </section>
      </main>
      <WorkspaceFooter />
    </div>
  );
}
