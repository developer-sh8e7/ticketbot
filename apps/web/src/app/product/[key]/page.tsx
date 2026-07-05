import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, Bot, Check, Code2, Megaphone, Mic2, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react';
import { PublicFrame } from '@/components/ui';
import { ProductBuyRow } from '@/components/ProductBuyRow';
import { products, site, type ProductKey } from '@/lib/site-content';
import { getPublicStock, type StockStatus } from '@/lib/public-stock';

const icons: Record<ProductKey, LucideIcon> = {
  ticket: Ticket,
  voice_rooms: Mic2,
  general: Bot,
  broadcast: Megaphone,
  humanguard: ShieldCheck,
  custom: Code2,
};

const STOCK_LABEL: Record<StockStatus, string> = {
  in: 'متوفر الآن — توصيل فوري',
  low: 'كمية محدودة',
  out: 'نفد مؤقتاً',
};

// Live token stock is read per request, so availability is always accurate.
export const dynamic = 'force-dynamic';

export default async function ProductDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const product = products().find((p) => p.key === key);
  if (!product) notFound();

  const Icon = icons[product.key];
  const isCustom = product.productType === 'custom';
  const stock = await getPublicStock();
  const status = stock[product.productType];
  const soldOut = status === 'out';

  return (
    <PublicFrame>
      <section dir="rtl" className="py-14">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 font-arabic text-xs font-bold text-[var(--color-muted)] transition hover:text-[var(--color-text)]"
        >
          <ArrowRight size={14} />
          رجوع للمتجر
        </Link>

        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* Main */}
          <div>
            <div className="flex items-center gap-4">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-2xl text-[var(--color-accent)]"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
              >
                <Icon size={28} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-arabic text-3xl font-extrabold text-[var(--color-text)]">{product.name}</h1>
                  {product.badge ? (
                    <span className="rounded-full bg-[var(--color-accent)] px-2.5 py-1 font-arabic text-[11px] font-extrabold text-black">
                      {product.badge}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 font-arabic text-sm text-[var(--color-muted)]">{product.shortName}</p>
              </div>
            </div>

            <p className="mt-7 font-arabic text-[15px] leading-8 text-[var(--color-muted)]">{product.description}</p>

            <h2 className="mt-10 font-arabic text-xl font-extrabold text-[var(--color-text)]">المميزات</h2>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2">
              {product.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-arabic text-sm leading-7 text-[var(--color-text)]"
                >
                  <Check size={17} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>

            {product.manualActivation ? (
              <p className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 font-arabic text-xs leading-6 text-[var(--color-muted)]">
                ℹ️ هذا المنتج يُفعّل يدوياً عبر تذكرة في Discord بعد الشراء — لضبط الإعدادات حسب سيرفرك.
              </p>
            ) : null}
          </div>

          {/* Sidebar — purchase */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            {status ? (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] px-3 py-1.5 font-arabic text-xs font-bold text-[var(--color-muted)]">
                <span className={`h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] ${soldOut ? 'opacity-30' : status === 'low' ? 'opacity-60' : 'opacity-100'}`} />
                {STOCK_LABEL[status]}
              </div>
            ) : null}

            {isCustom ? (
              <div dir="rtl" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
                <p className="font-arabic text-sm font-bold text-[var(--color-text)]">بوت مخصص حسب طلبك</p>
                <p className="mt-2 font-arabic text-xs leading-6 text-[var(--color-muted)]">
                  لا يوجد شراء مباشر. افتح تذكرة وسنبني لك البوت حسب فكرتك.
                </p>
                <a
                  href={site.supportDiscordUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90"
                >
                  تواصل مع المطورين
                </a>
              </div>
            ) : (
              <ProductBuyRow
                product={{
                  key: product.key,
                  id: product.id,
                  name: product.name,
                  productType: product.productType,
                  price_monthly: product.price_monthly,
                  price_quarterly: product.price_quarterly,
                }}
                soldOut={soldOut}
              />
            )}

            <p className="mt-4 px-1 font-arabic text-[11px] leading-6 text-[var(--color-muted)]">
              الدفع آمن عبر PayPal/البطاقة. بعد الدفع يوصلك البوت تلقائياً لسيرفرك خلال دقيقة.
            </p>
          </aside>
        </div>
      </section>
    </PublicFrame>
  );
}
