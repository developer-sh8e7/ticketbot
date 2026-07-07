import type { Metadata } from 'next';
import { Cairo, Inter } from 'next/font/google';
import './globals.css';
import { VisitLogger } from '@/components/VisitLogger';
import { CartProvider } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { OpiRoot } from '@/components/opi/OpiRoot';

const arabicFont = Cairo({
  subsets: ['arabic'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-cairo',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

const englishFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
  variable: '--font-english',
  fallback: ['system-ui', 'Arial', 'sans-serif'],
});

function metadataBaseUrl() {
  const appUrl = process.env.APP_URL?.trim();
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  const fallback = vercelUrl ? (/^https?:\/\//i.test(vercelUrl) ? vercelUrl : `https://${vercelUrl}`) : 'http://localhost:3000';
  return new URL(appUrl || fallback);
}

export const metadata: Metadata = {
  metadataBase: metadataBaseUrl(),
  title: {
    default: 'Opus Solutions — بوتات Discord عربية احترافية',
    template: '%s — Opus Solutions',
  },
  description: 'بوتات Discord عربية احترافية — Bot Ticket، SystemBot، HumanGuard AI، وتطوير بوتات مخصصة.',
  openGraph: {
    title: 'Opus Solutions — بوتات Discord عربية احترافية',
    description: 'حلول بوتات Discord عربية لإدارة وتنمية سيرفراتك — Bot Ticket، SystemBot، HumanGuard AI، وتطوير مخصص.',
    type: 'website',
    locale: 'ar_SA',
    siteName: 'Opus Solutions',
    images: [{ url: '/og-opus.svg', width: 1200, height: 630, alt: 'Opus Solutions preview' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Opus Solutions — بوتات Discord عربية احترافية',
    description: 'بوتات Discord عربية — حلول متكاملة لسيرفراتك.',
    images: ['/og-opus.svg'],
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${arabicFont.variable} ${englishFont.variable}`}>
        <CartProvider>
          <VisitLogger />
          <div className="opus-grid" aria-hidden="true" />
          {children}
          <CartDrawer />
          <OpiRoot />
        </CartProvider>
      </body>
    </html>
  );
}
