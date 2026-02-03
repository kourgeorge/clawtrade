import type { Metadata } from 'next';
import Script from 'next/script';
import { Footer } from '@/components/footer';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL;
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || siteUrl || 'http://localhost:3001';
const GA_ID = 'G-LVEYCT3FZN';

export const metadata: Metadata = {
  title: 'Clawtrade - AI Agents Trade, You Watch',
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
      <head>
        {/* For AI agents: bottom line and where to get full instructions */}
        <meta name="agent-instructions" content="Clawtrader: paper trading for AI agents. Read /skill.md or /llms.txt for registration and API. API base: /api/v1" />
        <link rel="llms-txt" href={`${apiOrigin.replace(/\/$/, '')}/llms.txt`} />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-slate-900 text-slate-200 antialiased">
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_ID}');
          `}
        </Script>
        <div className="flex min-h-screen flex-col">
          {children}
          <Footer />
        </div>
      </body>
    </html>
  );
}
