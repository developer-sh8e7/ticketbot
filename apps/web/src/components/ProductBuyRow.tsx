'use client';

import Link from 'next/link';
import { Check, Plus } from 'lucide-react';
import { useState } from 'react';
import { buildCartItem, useCart, type CartDuration } from '@/components/cart/CartProvider';

type BuyProduct = {
  key: string;
  id: string;
  name: string;
  productType: string;
  price_monthly: number;
  price_quarterly: number;
};

/** Duration toggle + add-to-cart + buy-now for the product detail page. */
export function ProductBuyRow({ product, soldOut }: { product: BuyProduct; soldOut?: boolean }) {
  const { addItem } = useCart();
  const [duration, setDuration] = useState<CartDuration>('monthly');
  const [added, setAdded] = useState(false);

  const amount = duration === 'monthly' ? product.price_monthly : product.price_quarterly;

  function handleAdd() {
    addItem(buildCartItem(product, duration));
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  const opt = (value: CartDuration, label: string, price: number) => {
    const active = duration === value;
    return (
      <button
        type="button"
        onClick={() => setDuration(value)}
        className={`flex-1 rounded-xl border px-4 py-3 text-center font-arabic text-sm font-bold transition ${
          active
            ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-black'
            : 'border-[var(--color-border)] text-[var(--color-text)] hover:border-[var(--color-accent)]'
        }`}
      >
        {label}
        <span className="mt-1 block font-english text-lg font-extrabold">${price}</span>
      </button>
    );
  };

  if (soldOut) {
    return (
      <div dir="rtl" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="font-arabic text-sm font-bold text-[var(--color-text)]">نفدت الكمية مؤقتاً</p>
        <p className="mt-2 font-arabic text-xs leading-6 text-[var(--color-muted)]">
          نعمل على توفير المزيد قريباً. تواصل مع الدعم وسنبلغك فور التوفّر.
        </p>
      </div>
    );
  }

  return (
    <div dir="rtl" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex gap-3">
        {opt('monthly', 'شهري', product.price_monthly)}
        {product.price_quarterly > 0 ? opt('3_months', '3 شهور', product.price_quarterly) : null}
      </div>

      <div className="mt-4 flex items-stretch gap-2">
        <Link
          href={`/bots?product=${product.key}&duration=${duration}#prices`}
          className="flex-1 inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-4 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90"
        >
          اشترِ الآن — ${amount}
        </Link>
        <button
          type="button"
          onClick={handleAdd}
          className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] hover:text-black"
          aria-label={`أضف ${product.name} للسلة`}
        >
          {added ? <Check size={18} /> : <Plus size={18} />}
        </button>
      </div>
    </div>
  );
}
