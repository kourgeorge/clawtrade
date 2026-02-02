import type { Metadata } from 'next';
import Script from 'next/script';
import './globals.css';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_API_URL;
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
        {children}
      </body>
    </html>
  );
}
