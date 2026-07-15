import type { Metadata } from 'next';
import { Cairo, Inter } from 'next/font/google';
import './globals.css';
import { VisitLogger } from '@/components/VisitLogger';
import { CartProvider } from '@/components/cart/CartProvider';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { OpiRoot } from '@/components/opi/OpiRoot';
import { WhatsAppButton } from '@/components/WhatsAppButton';

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
  alternates: { canonical: '/' },
  title: {
    default: 'Opus | تصميم وبرمجة موقعك أو تطبيقك',
    template: '%s | Opus Solutions',
  },
  applicationName: 'Opus Solutions',
  creator: 'Opus Solutions',
  publisher: 'Opus Solutions',
  verification: { google: process.env.GOOGLE_SITE_VERIFICATION },
  keywords: ['Opus Solutions', 'Opussolutions', 'تصميم موقع', 'برمجة موقع', 'تطوير تطبيق', 'برمجة تطبيق', 'مشروع تخرج برمجي', 'تصميم لوحة تحكم', 'برمجة نظام مخصص'],
  description: 'نصمم ونطوّر مواقع وتطبيقات وأنظمة رقمية للطلاب وأصحاب الأفكار والأعمال، من الفكرة إلى منتج رقمي جاهز للاستخدام.',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1, 'max-video-preview': -1 },
  },
  openGraph: {
    title: 'Opus | تصميم وبرمجة موقعك أو تطبيقك',
    description: 'نصمم ونطوّر مواقع وتطبيقات وأنظمة رقمية للطلاب وأصحاب الأفكار والأعمال، من الفكرة إلى منتج رقمي جاهز للاستخدام.',
    type: 'website',
    locale: 'ar_SA',
    siteName: 'Opus Solutions',
    images: [{ url: '/og-opus.png', width: 1200, height: 630, alt: 'Opus لتصميم وبرمجة المواقع والتطبيقات' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Opus | تصميم وبرمجة موقعك أو تطبيقك',
    description: 'نصمم ونطوّر مواقع وتطبيقات وأنظمة رقمية للطلاب وأصحاب الأفكار والأعمال.',
    images: ['/og-opus.png'],
  },
  icons: {
    icon: '/icon.png',
    apple: '/apple-touch-icon.png',
  },
};

const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': ['Organization', 'ProfessionalService'],
  name: 'Opus Solutions',
  url: 'https://opussolutions.xyz',
  logo: 'https://i.imgur.com/0404vFj.png',
  image: 'https://opussolutions.xyz/og-opus.png',
  telephone: '+966597232969',
  areaServed: { '@type': 'Country', name: 'Saudi Arabia' },
  availableLanguage: ['ar'],
  serviceType: ['تصميم وتطوير المواقع', 'برمجة التطبيقات', 'برمجة الأنظمة المخصصة', 'مواقع وتطبيقات للطلاب'],
  contactPoint: {
    '@type': 'ContactPoint',
    telephone: '+966597232969',
    contactType: 'customer service',
    availableLanguage: ['Arabic'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body className={`${arabicFont.variable} ${englishFont.variable}`}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
        <CartProvider>
          <VisitLogger />
          <div className="opus-grid" aria-hidden="true" />
          {children}
          <CartDrawer />
          <WhatsAppButton />
          <OpiRoot />
        </CartProvider>
      </body>
    </html>
  );
}
