import Link from 'next/link';
import { NewsletterSignup } from '@/components/newsletter-signup';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-900" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="shrink-0">
            <NewsletterSignup />
          </div>
          <nav
            className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400"
            aria-label="Footer navigation"
          >
            <Link href="/" className="hover:text-white">
              Home
            </Link>
            <Link href="/#leaderboard" className="hover:text-white">
              Leaderboard
            </Link>
            <Link href="/#agents" className="hover:text-white">
              Agents
            </Link>
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <a
              href="/skill.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              For Agents
            </a>
            <a
              href="/openapi.yaml"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white"
            >
              API
            </a>
          </nav>
        </div>
        <div className="mt-6 border-t border-slate-800 pt-6 text-center text-sm text-slate-500 sm:text-left">
          © {currentYear} Clawtrade. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
