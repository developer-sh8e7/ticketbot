'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bot, Code2, Mic2, ShieldCheck, Ticket, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProductKey } from '@/lib/site-content';

type HomeProduct = {
  key: ProductKey;
  name: string;
  shortDescription: string;
  priceLabel: string;
  href: string;
  external: boolean;
  ctaLabel: string;
  disabled?: boolean;
};

type HomeProductsGridProps = {
  products: HomeProduct[];
};

const icons: Record<ProductKey, LucideIcon> = {
  ticket: Ticket,
  voice_rooms: Mic2,
  general: Bot,
  humanguard: ShieldCheck,
  custom: Code2,
};

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
};

const card = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

function ProductCta({ href, external, disabled, children }: { href: string; external: boolean; disabled?: boolean; children: ReactNode }) {
  const className =
    'mt-auto inline-flex w-full items-center justify-center rounded-xl border border-[var(--color-border)] px-4 py-2.5 font-arabic text-sm font-extrabold text-[var(--color-text)] transition';
  const activeClassName = `${className} hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]`;

  if (disabled) {
    return <span className={`${className} cursor-not-allowed opacity-60`}>{children}</span>;
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={activeClassName}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={activeClassName}>
      {children}
    </Link>
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
      <motion.h2
        variants={card}
        className="text-center font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]"
      >
        منتجاتنا
      </motion.h2>

      <motion.div variants={container} className="mt-10 grid gap-5 md:grid-cols-2">
        {products.map((product) => {
          const Icon = icons[product.key];
          return (
            <motion.article
              key={product.key}
              variants={card}
              className="product-card flex min-h-72 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition duration-200 hover:-translate-y-1 hover:border-[var(--color-accent)]"
            >
              <div
                className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl text-[var(--color-accent)]"
                style={{ background: 'color-mix(in srgb, var(--color-accent) 15%, transparent)' }}
              >
                <Icon size={24} />
              </div>

              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <h3 className="font-arabic text-2xl font-extrabold text-[var(--color-text)]">{product.name}</h3>
                <span className="rounded-full border border-[var(--color-accent-2)] px-3 py-1 font-english text-xs font-bold text-[var(--color-accent-2)]">
                  {product.priceLabel}
                </span>
              </div>

              <p className="mb-6 text-sm leading-7 text-[var(--color-muted)]">{product.shortDescription}</p>

              <ProductCta href={product.href} external={product.external} disabled={product.disabled}>
                {product.ctaLabel}
              </ProductCta>
            </motion.article>
          );
        })}
      </motion.div>
    </motion.section>
  );
}
