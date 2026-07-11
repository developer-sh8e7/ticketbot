'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Bot, Check, Code2, Megaphone, Mic2, Plus, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import type { ProductKey } from '@/lib/site-content';
import type { StockStatus } from '@/lib/public-stock';
import { buildCartItem, useCart } from '@/components/cart/CartProvider';
import { InfoTip } from '@/components/InfoTip';

type HomeProduct = {
  key: ProductKey;
  id: string;
  name: string;
  productType: string;
  shortDescription: string;
  description: string;
  priceLabel: string;
  price_monthly: number;
  price_quarterly: number;
  features: string[];
  badge?: string;
  stockStatus?: StockStatus;
  detailHref: string;
  href: string;
  external: boolean;
  ctaLabel: string;
  disabled?: boolean;
  purchasable?: boolean;
};

type HomeProductsGridProps = {
  products: HomeProduct[];
};

const icons: Record<ProductKey, LucideIcon> = {
  ticket: Ticket,
  voice_rooms: Mic2,
  general: Bot,
  broadcast: Megaphone,
  humanguard: ShieldCheck,
  custom: Code2,
};

const STOCK_LABEL: Record<StockStatus, string> = {
  in: 'متوفر الآن',
  low: 'كمية محدودة',
  out: 'نفد مؤقتاً',
};

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const card = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

function StockPill({ status }: { status: StockStatus }) {
  // Pure B&W: a filled dot conveys state via fill/outline, not color.
  const dot = status === 'out' ? 'opacity-30' : status === 'low' ? 'opacity-60' : 'opacity-100';
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] px-2.5 py-1 font-arabic text-[11px] font-bold text-[var(--color-muted)]">
      <span className={`h-1.5 w-1.5 rounded-full bg-[var(--color-accent)] ${dot}`} />
      {STOCK_LABEL[status]}
    </span>
  );
}

function ProductCta({ href, external, disabled, children }: { href: string; external: boolean; disabled?: boolean; children: ReactNode }) {
  const base =
    'mt-auto inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-arabic text-sm font-extrabold transition';
  const active = `${base} bg-[var(--color-accent)] text-black hover:-translate-y-0.5 hover:opacity-90`;

  if (disabled) {
    return <span className={`${base} cursor-not-allowed border border-[var(--color-border)] text-[var(--color-text)] opacity-60`}>{children}</span>;
  }
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={active}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={active}>
      {children}
    </Link>
  );
}

function AddToCartButton({ product }: { product: HomeProduct }) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  function handleAdd() {
    addItem(buildCartItem(product, 'monthly'));
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleAdd}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black"
      aria-label={`أضف ${product.name} للسلة`}
    >
      {added ? <Check size={18} /> : <Plus size={18} />}
    </button>
  );
}

export function HomeProductsGrid({ products }: HomeProductsGridProps) {
  return (
    <motion.section
      dir="rtl"
      className="py-20"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-80px' }}
      variants={container}
    >
      <motion.h2 variants={card} className="text-center font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">
        منتجاتنا
      </motion.h2>
      <motion.p variants={card} className="mx-auto mt-3 max-w-xl text-center text-sm leading-7 text-[var(--color-muted)]">
        حلول جاهزة لبوتات Discord، أو مشروع مخصص نبنيه حول فكرتك واحتياجك.
      </motion.p>

      <motion.div variants={container} className="mt-10 grid gap-5 md:grid-cols-2">
        {products.map((product) => {
          const Icon = icons[product.key];
          const out = product.stockStatus === 'out';
          return (
            <motion.article
              key={product.key}
              variants={card}
              whileHover={{ y: -4 }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
              className="product-card group relative flex min-h-72 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors duration-200 hover:border-[var(--color-accent)]"
            >
              {product.badge ? (
                <span className="absolute left-5 top-5 rounded-full bg-[var(--color-accent)] px-2.5 py-1 font-arabic text-[11px] font-extrabold text-black">
                  {product.badge}
                </span>
              ) : null}

              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-[var(--color-accent)] transition-transform duration-200 group-hover:scale-110"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
              >
                <Icon size={24} />
              </div>

              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-arabic text-2xl font-extrabold text-[var(--color-text)]">{product.name}</h3>
                  <InfoTip label={`عن ${product.name}`} text={product.description} />
                </div>
                {product.stockStatus ? <StockPill status={product.stockStatus} /> : null}
              </div>

              <p className="mb-4 text-sm leading-7 text-[var(--color-muted)]">{product.shortDescription}</p>

              {product.features.length ? (
                <ul className="mb-5 grid gap-2">
                  {product.features.slice(0, 3).map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-[13px] leading-6 text-[var(--color-muted)]">
                      <Check size={15} className="mt-0.5 shrink-0 text-[var(--color-accent-2)]" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              {product.price_monthly > 0 ? (
                <div className="mb-4 flex items-end gap-2">
                  <span className="font-english text-3xl font-extrabold text-[var(--color-text)]">${product.price_monthly}</span>
                  <span className="mb-1 font-arabic text-xs text-[var(--color-muted)]">/ شهرياً</span>
                  {product.price_quarterly > 0 ? (
                    <span className="mb-1 mr-auto rounded-full border border-[var(--color-border)] px-2 py-0.5 font-english text-[11px] text-[var(--color-accent-2)]">
                      ${product.price_quarterly} / 3 شهور
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mb-4 font-arabic text-sm font-bold text-[var(--color-accent-2)]">{product.priceLabel}</div>
              )}

              <div className="mt-auto flex items-stretch gap-2">
                <div className="flex-1">
                  <ProductCta
                    href={out ? product.detailHref : product.href}
                    external={product.external}
                    disabled={product.disabled}
                  >
                    {out ? 'تفاصيل المنتج' : product.ctaLabel}
                  </ProductCta>
                </div>
                {product.purchasable && !out ? <AddToCartButton product={product} /> : null}
              </div>

              <Link
                href={product.detailHref}
                className="mt-3 inline-flex items-center justify-center gap-1 font-arabic text-xs font-bold text-[var(--color-muted)] transition hover:text-[var(--color-text)]"
              >
                التفاصيل الكاملة والمميزات
                <ArrowLeft size={13} />
              </Link>
            </motion.article>
          );
        })}
      </motion.div>
    </motion.section>
  );
}
