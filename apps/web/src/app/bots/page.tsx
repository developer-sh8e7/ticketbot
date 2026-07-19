import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, SquareTerminal } from 'lucide-react';
import { FaqAccordion } from '@/components/FaqAccordion';
import { HomeProductsGrid } from '@/components/HomeProductsGrid';
import { MotionSection } from '@/components/MotionSection';
import { PricingCheckout } from '@/components/PricingCheckout';
import { PublicFrame } from '@/components/ui';
import { WelcomeScene3D } from '@/components/WelcomeScene3D';
import { products } from '@/lib/site-content';
import { getPublicStock } from '@/lib/public-stock';
import { getSession } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'BOTS Discord',
  description: 'بوتات Discord عربية للتذاكر والإدارة والحماية والرومات المؤقتة مع أسعار واشتراكات واضحة.',
  alternates: { canonical: '/bots' },
  robots: { index: false, follow: false },
};

type BotsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function botsReturnTo(params: Record<string, string | string[] | undefined>) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) value.forEach((item) => query.append(key, item));
    else if (value !== undefined) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `/bots?${encoded}` : '/bots';
}

export default async function BotsPage({ searchParams }: BotsPageProps) {
  const session = await getSession();
  if (!session) {
    const returnTo = botsReturnTo(await searchParams);
    redirect(`/api/auth/discord?returnTo=${encodeURIComponent(returnTo)}`);
  }

  const botProducts = products().filter((product) => product.key !== 'custom');
  const stock = await getPublicStock();
  const productCards = botProducts.map((product) => {
    const isSoon = product.priceLabel.toLowerCase() === 'soon';
    return {
      key: product.key,
      id: product.id,
      name: product.name,
      productType: product.productType,
      shortDescription: product.shortDescription,
      description: product.description,
      priceLabel: product.priceLabel,
      price_monthly: product.price_monthly,
      price_quarterly: product.price_quarterly,
      features: product.features,
      badge: product.badge,
      stockStatus: stock[product.productType],
      detailHref: `/product/${product.key}`,
      href: `/bots?product=${product.key}#prices`,
      external: false,
      ctaLabel: isSoon ? 'قريباً' : 'اختر الباقة',
      disabled: isSoon,
      purchasable: !isSoon && product.price_monthly > 0,
    };
  });

  return (
    <PublicFrame>
      <MotionSection className="mx-auto max-w-6xl py-8 md:py-14">
        <div dir="rtl" className="grid items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="text-center lg:text-right">
            <p className="font-english text-sm font-bold tracking-[0.18em] text-[var(--color-accent)]">BOTS Discord</p>
            <h1 className="mt-4 text-balance font-arabic text-4xl font-extrabold leading-tight text-[var(--color-text)] md:text-6xl">بوتات Discord جاهزة لسيرفرك</h1>
            <p className="mt-5 max-w-2xl font-arabic text-base leading-8 text-[var(--color-muted)]">اختر البوت المناسب، تعرّف على مميزاته، ثم حدّد مدة الاشتراك والسعر من نفس الصفحة.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2 font-arabic text-[11px] font-bold text-[var(--color-muted)] lg:justify-start">
              {['إعدادات محفوظة', 'تفعيل واضح', 'دعم عربي'].map((point) => <span key={point} className="rounded-full border border-[var(--color-border)] px-3 py-1.5">{point}</span>)}
            </div>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <a href="#prices" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90">عرض الأسعار <ArrowLeft size={16} /></a>
              <Link href="/commands" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-5 py-3 font-arabic text-sm font-bold text-[var(--color-text)] transition hover:border-[var(--color-accent)]"><SquareTerminal size={16} /> استعراض الأوامر</Link>
            </div>
          </div>
          <div className="pointer-events-none h-72 sm:h-80 lg:h-[430px]" aria-hidden="true">
            <WelcomeScene3D variant="bots" />
          </div>
        </div>
      </MotionSection>

      <HomeProductsGrid
        products={productCards}
        title="بوتاتنا"
        description="بوتات عربية للتذاكر، الإدارة، الرومات المؤقتة، الحماية والبرودكاست."
      />

      <MotionSection id="prices" className="scroll-mt-28 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">الأسعار والاشتراك</h2>
          <p className="mt-4 font-arabic text-sm leading-7 text-[var(--color-muted)]">
            اختر البوت ومدة الاشتراك، ثم أكمل الدفع بالطريقة المناسبة لك.
          </p>
        </div>
        <div className="mx-auto max-w-2xl">
          <PricingCheckout products={botProducts} />
        </div>
      </MotionSection>

      <MotionSection className="mx-auto max-w-3xl py-20">
        <div className="mb-8 text-center">
          <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">أسئلة البوتات الشائعة</h2>
          <p className="mt-4 font-arabic text-sm leading-7 text-[var(--color-muted)]">إجابات مختصرة قبل الاشتراك والتفعيل.</p>
        </div>
        <FaqAccordion />
      </MotionSection>
    </PublicFrame>
  );
}
