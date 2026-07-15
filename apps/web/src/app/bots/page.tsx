import Link from 'next/link';
import { ArrowLeft, SquareTerminal } from 'lucide-react';
import { FaqAccordion } from '@/components/FaqAccordion';
import { HomeProductsGrid } from '@/components/HomeProductsGrid';
import { PricingCheckout } from '@/components/PricingCheckout';
import { PublicFrame } from '@/components/ui';
import { products } from '@/lib/site-content';
import { getPublicStock } from '@/lib/public-stock';

export const dynamic = 'force-dynamic';

export default async function BotsPage() {
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
      <section dir="rtl" className="mx-auto max-w-3xl py-12 text-center md:py-16">
        <p className="font-english text-sm font-bold uppercase tracking-[0.24em] text-[var(--color-accent)]">Opus Bots</p>
        <h1 className="mt-4 text-balance font-arabic text-4xl font-extrabold leading-tight text-[var(--color-text)] md:text-6xl">
          بوتات Discord جاهزة لسيرفرك
        </h1>
        <p className="mx-auto mt-5 max-w-2xl font-arabic text-base leading-8 text-[var(--color-muted)]">
          اختر البوت المناسب، تعرّف على مميزاته، ثم حدّد مدة الاشتراك والسعر من نفس الصفحة.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <a href="#prices" className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90">
            عرض الأسعار <ArrowLeft size={16} />
          </a>
          <Link href="/commands" className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border)] px-5 py-3 font-arabic text-sm font-bold text-[var(--color-text)] transition hover:border-[var(--color-accent)]">
            <SquareTerminal size={16} /> استعراض الأوامر
          </Link>
        </div>
      </section>

      <HomeProductsGrid
        products={productCards}
        title="بوتاتنا"
        description="بوتات عربية للتذاكر، الإدارة، الرومات المؤقتة، الحماية والبرودكاست."
      />

      <section id="prices" dir="rtl" className="scroll-mt-28 py-20">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">الأسعار والاشتراك</h2>
          <p className="mt-4 font-arabic text-sm leading-7 text-[var(--color-muted)]">
            اختر البوت ومدة الاشتراك، ثم أكمل الدفع بالطريقة المناسبة لك.
          </p>
        </div>
        <div className="mx-auto max-w-2xl">
          <PricingCheckout products={botProducts} />
        </div>
      </section>

      <section dir="rtl" className="mx-auto max-w-3xl py-20">
        <div className="mb-8 text-center">
          <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">أسئلة البوتات الشائعة</h2>
          <p className="mt-4 font-arabic text-sm leading-7 text-[var(--color-muted)]">إجابات مختصرة قبل الاشتراك والتفعيل.</p>
        </div>
        <FaqAccordion />
      </section>
    </PublicFrame>
  );
}
