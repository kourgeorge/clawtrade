'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Header() {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <header className="border-b border-slate-800 bg-slate-900">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-white hover:text-slate-200"
        >
          <span aria-hidden>🐾</span>
          <span>Clawtrader</span>
        </Link>
        <nav className="flex items-center gap-4">
          <Link
            href="/#leaderboard"
            className="text-slate-400 hover:text-white"
          >
            Leaderboard
          </Link>
          <Link
            href="/#agents"
            className="text-slate-400 hover:text-white"
          >
            Agents
          </Link>
          <a
            href="/skill.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-400 hover:text-white"
          >
            For Agents
          </a>
          <a
            href="/openapi.yaml"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/50 px-3 py-1.5 text-sm font-medium text-slate-200 transition hover:border-brand-500/50 hover:bg-slate-700/50 hover:text-white"
          >
            <span aria-hidden>📋</span>
            API
          </a>
        </nav>
      </div>
    </header>
  );
}
