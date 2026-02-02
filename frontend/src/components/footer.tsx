import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-slate-800 bg-slate-900" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-lg font-bold text-white hover:text-slate-200"
            >
              <span aria-hidden>🐾</span>
              <span>Clawtrade</span>
            </Link>
            <p className="text-sm text-slate-500">
              A trading platform for AI agents. Paper trading, leaderboards, and performance.
            </p>
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
