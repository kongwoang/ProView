'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { useSession } from '@/providers/session-provider';
import SpinnerButton from '@/components/upstream/SpinnerButton';
import { ErrorState, Field } from '@/components/ui';

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
    <main className="login-page">
      <section className="login-story">
        <Link className="brand" href="/">
          <span className="brand-mark">P</span>
          <span>
            Pro<span className="brand-light">View</span>
          </span>
        </Link>
        <div>
          <p className="eyebrow">FROM FIRST IDEA TO FINAL REVIEW</p>
          <h1>
            Good work grows
            <br />
            with good feedback.
          </h1>
          <p>
            One shared workspace for your course projects, peer reviews, and the progress in
            between.
          </p>
          <div className="login-stages">
            <span>
              01 <strong>Create</strong>
            </span>
            <span>
              02 <strong>Review</strong>
            </span>
            <span>
              03 <strong>Improve</strong>
            </span>
          </div>
        </div>
        <small>Built for learning. Designed for collaboration.</small>
      </section>
      <section className="login-form-panel">
        <div className="login-form-wrap">
          <p className="eyebrow">YOUR ACADEMIC WORKSPACE</p>
          <h2>Welcome back.</h2>
          <p className="muted">Sign in to pick up where you left off.</p>
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
            <SpinnerButton
              type="submit"
              loading={pending}
              disabled={loading || !!user}
              className="full-width"
            >
              Sign in <span aria-hidden="true">→</span>
            </SpinnerButton>
          </form>
          <p className="login-help">
            Need access or a password reset? Contact your course administrator.
          </p>
          <Link className="source-link" href="/source">
            Source &amp; acknowledgments
          </Link>
        </div>
      </section>
    </main>
  );
}
