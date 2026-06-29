import Link from 'next/link';
import { Check, ShieldCheck, SlidersHorizontal, Ticket } from 'lucide-react';
import { FaqAccordion } from '@/components/FaqAccordion';
import { HomeHero } from '@/components/HomeHero';
import { HomeProductsGrid } from '@/components/HomeProductsGrid';
import { MotionSection } from '@/components/MotionSection';
import { PremiumStatsSection } from '@/components/PremiumStatsSection';
import { PublicFrame } from '@/components/ui';
import { primaryFeatures, products } from '@/lib/site-content';

const featureIcons = [Ticket, SlidersHorizontal, ShieldCheck] as const;

export default function HomePage() {
  const allProducts = products();
  const productCards = allProducts.map((product) => {
    const isSoon = product.priceLabel.toLowerCase() === 'soon';
    const isCustom = product.productType === 'custom';
    return {
      key: product.key,
      id: product.id,
      name: product.name,
      productType: product.productType,
      shortDescription: product.shortDescription,
      priceLabel: product.priceLabel,
      price_monthly: product.price_monthly,
      price_quarterly: product.price_quarterly,
      href: `/pricing?product=${product.key}`,
      external: false,
      ctaLabel: isSoon ? 'Soon' : 'اشترِ الآن',
      disabled: isSoon,
      purchasable: !isSoon && !isCustom && product.price_monthly > 0,
    };
  });

  return (
    <PublicFrame>
      <HomeHero />

      <PremiumStatsSection />

      <HomeProductsGrid products={productCards} />

      <MotionSection className="py-20" >
        <div dir="rtl" className="text-center">
          <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">لماذا Opus؟</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[var(--color-muted)]">
            تجربة تشغيل واضحة، إعدادات منظمة، ودعم عربي يناسب ملاك السيرفرات.
          </p>
        </div>

        <div dir="rtl" className="mt-10 grid gap-5 md:grid-cols-3">
          {primaryFeatures.map((feature, index) => {
            const Icon = featureIcons[index] ?? Ticket;
            return (
              <article
                key={feature.title}
                className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"
              >
                <div
                  className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl text-[var(--color-accent)]"
                  style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
                >
                  <Icon size={22} />
                </div>
                <h3 className="font-arabic text-xl font-extrabold text-[var(--color-text)]">{feature.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[var(--color-muted)]">{feature.description}</p>
                <ul className="mt-5 grid gap-2">
                  {feature.points.slice(0, 3).map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm leading-7 text-[var(--color-muted)]">
                      <Check size={16} className="mt-1 shrink-0 text-[var(--color-accent-2)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </MotionSection>

      <MotionSection className="mx-[calc(50%-50vw)] w-screen py-20">
        <div
          dir="rtl"
          className="border-y border-[var(--color-border)] px-6 py-14 text-center md:px-10"
          style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-bg) 72%)' }}
        >
          <div className="mx-auto max-w-6xl">
            <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">جاهز تبدأ مع Opus؟</h2>
            <div className="mt-7">
              <Link
                href="/pricing"
                className="inline-flex items-center justify-center rounded-xl bg-[var(--color-text)] px-6 py-3 font-arabic text-sm font-extrabold text-[var(--color-bg)] transition hover:-translate-y-0.5 hover:opacity-90"
              >
                اشترِ الآن
              </Link>
            </div>
          </div>
        </div>
      </MotionSection>

      <MotionSection className="py-20">
        <div dir="rtl" className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">الأسئلة الشائعة</h2>
            <p className="mt-4 text-sm leading-8 text-[var(--color-muted)]">إجابات مختصرة قبل الشراء والتفعيل.</p>
          </div>
          <FaqAccordion />
          <div className="mt-8 text-center">
            <Link href="/pricing" className="text-sm font-bold text-[var(--color-accent)] underline underline-offset-4">
              عرض تفاصيل الأسعار
            </Link>
          </div>
        </div>
      </MotionSection>
    </PublicFrame>
  );
}
