'use client';

import Link from 'next/link';
import { Check } from 'lucide-react';
import { products } from '@/lib/site-content';
import { ButtonLink, ProductIcon } from './ui';

export function PricingTabs() {
  const all = products();

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {all.map((product) => {
        const hasBuyLink = !!product.productUrl;
        return (
          <div
            key={product.key}
            className={`relative flex flex-col rounded-xl border bg-opus-card/50 p-5 transition-all duration-200 hover:border-opus-border ${
              product.featured
                ? 'border-opus-accent/30'
                : 'border-opus-border/60'
            } ${!hasBuyLink ? 'opacity-70' : ''}`}
          >
            {/* Featured pill */}
            {product.featured ? (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-opus-accent/30 bg-opus-accent/10 px-3 py-0.5 text-[11px] font-semibold text-opus-accent">
                مميز
              </span>
            ) : null}

            {/* Icon */}
            <ProductIcon name={product.icon} className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl border border-opus-border/60 bg-opus-panel text-opus-accent" />

            {/* Name + short description */}
            <h3 className="text-base font-extrabold text-opus-text">{product.name}</h3>
            <p className="mt-1 text-xs leading-6 text-opus-muted">
              {product.shortDescription}
            </p>

            {/* Price */}
            <p className={`mt-3 text-lg font-bold ${hasBuyLink ? 'text-opus-accent' : 'text-opus-muted'}`}>
              {product.priceLabel}
            </p>

            {/* Features — max 3 */}
            {product.features.length > 0 ? (
              <ul className="mt-4 grid gap-1.5 border-t border-opus-border/30 pt-4">
                {product.features.slice(0, 3).map((f) => (
                  <li key={f} className="flex items-center gap-2 text-[13px] text-opus-muted">
                    <Check size={12} className="shrink-0 text-opus-accent" />
                    {f}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Spacer */}
            <div className="grow" />

            {/* CTA */}
            <div className="mt-5">
              {hasBuyLink ? (
                <ButtonLink
                  href={product.productUrl!}
                  external
                  size="sm"
                  variant={product.featured ? 'solid' : 'outline'}
                >
                  Buy Now
                </ButtonLink>
              ) : (
                <span className="inline-flex items-center justify-center rounded-xl border border-opus-border bg-opus-panel px-4 py-2 text-xs text-opus-muted">
                  {product.key === 'custom' ? 'Request a Quote' : 'Coming Soon'}
                </span>
              )}
            </div>

            {/* Refund/cancellation link */}
            <Link
              href="/cancellation"
              className="mt-3 block text-center text-[11px] text-opus-muted underline underline-offset-2 opacity-60 hover:opacity-100"
            >
              Refund & Cancellation Policy
            </Link>
          </div>
        );
      })}
    </div>
  );
}
