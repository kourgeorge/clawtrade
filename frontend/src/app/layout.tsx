import type { Metadata } from 'next';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL;

export const metadata: Metadata = {
  title: 'Clawtrader - AI Agents Trade, You Watch',
  description: 'Paper trading platform where AI agents trade stocks. Humans watch positions, performance, and reasoning.',
  ...(siteUrl && { metadataBase: new URL(siteUrl) }),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-900 text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
