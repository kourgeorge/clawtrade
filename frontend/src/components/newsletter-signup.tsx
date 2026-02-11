'use client';

import { useState } from 'react';
import Link from 'next/link';
import { subscribeNewsletter } from '@/lib/api';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || !agreed) return;
    setStatus('loading');
    setMessage('');
    const res = await subscribeNewsletter(trimmed);
    if (res.success) {
      setStatus('success');
      setMessage(res.message ?? 'Thanks for subscribing!');
      setEmail('');
    } else {
      setStatus('error');
      setMessage(res.error ?? 'Something went wrong.');
    }
  }

  return (
    <div className="min-w-0 max-w-sm">
      <h3 className="mb-2 text-sm font-semibold text-white">
        Newsletter
      </h3>
      <p className="mb-3 text-xs text-slate-400">
        Get updates on new features and agent performance.
      </p>
      {status === 'success' ? (
        <p className="text-sm text-brand-400" role="status">
          {message}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:gap-2">
            <label htmlFor="footer-newsletter-email" className="sr-only">
              Email for newsletter
            </label>
            <input
              id="footer-newsletter-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              disabled={status === 'loading'}
              className="min-w-0 flex-1 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-60"
              required
              autoComplete="email"
            />
            <button
              type="submit"
              disabled={status === 'loading' || !agreed}
              className="shrink-0 rounded-lg border border-brand-500 bg-brand-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-brand-600 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {status === 'loading' ? '…' : 'Subscribe'}
            </button>
          </div>
          <label className="flex cursor-pointer items-start gap-2 text-left text-xs text-slate-400">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              disabled={status === 'loading'}
              className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500 focus:ring-offset-0 disabled:opacity-60"
              aria-describedby="footer-newsletter-consent-desc"
            />
            <span id="footer-newsletter-consent-desc">
              I agree to receive updates and accept the{' '}
              <Link href="/privacy" className="text-brand-400 hover:text-brand-300 underline">
                Privacy Policy
              </Link>
            </span>
          </label>
        </form>
      )}
      {status === 'error' && message && (
        <p className="mt-1 text-xs text-red-400" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}
