'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, CheckCircle2, Send, ShoppingCart } from 'lucide-react';
import { ProductPayPalCheckout } from '@/components/ProductPayPalCheckout';
import { buildCartItem, useCart } from '@/components/cart/CartProvider';
import type { Product } from '@/lib/site-content';

type BillingPeriod = 'monthly' | 'quarterly';

function amountForPeriod(product: Product, billingPeriod: BillingPeriod) {
  return billingPeriod === 'monthly' ? product.price_monthly : product.price_quarterly;
}

function hasPaidPrice(product: Product) {
  return product.price_monthly > 0 && product.price_quarterly > 0;
}

function priceLabelForPeriod(product: Product, billingPeriod: BillingPeriod) {
  const amount = amountForPeriod(product, billingPeriod);
  if (!Number.isFinite(amount) || amount <= 0) return product.priceLabel;
  return billingPeriod === 'monthly' ? `$${amount.toFixed(2)} / شهر` : `$${amount.toFixed(2)} / 3 شهور`;
}

function paypalMeHref(product: Product, billingPeriod: BillingPeriod) {
  const amount = amountForPeriod(product, billingPeriod);
  return amount > 0 ? `https://paypal.me/AAlamri381/${amount.toFixed(2)}` : '/pricing';
}

function durationForPeriod(billingPeriod: BillingPeriod) {
  return billingPeriod === 'monthly' ? 'monthly' as const : '3_months' as const;
}

function periodLabel(billingPeriod: BillingPeriod) {
  return billingPeriod === 'monthly' ? 'شهري' : '3 شهور';
}

function noteSuffix(billingPeriod: BillingPeriod) {
  return billingPeriod === 'monthly' ? 'Monthly' : '3 Months';
}

function ProductRow({
  product,
  selected,
  billingPeriod,
  onSelect,
}: {
  product: Product;
  selected: boolean;
  billingPeriod: BillingPeriod;
  onSelect: () => void;
}) {
  const paid = hasPaidPrice(product);
  const rowClassName = `flex min-h-[72px] w-full items-center justify-between gap-4 border-b border-[var(--color-border)] border-l-[3px] px-4 py-3 text-start transition last:border-b-0 ${
    selected
      ? 'border-l-[var(--color-accent)] bg-[rgba(255,138,0,0.05)]'
      : 'border-l-transparent bg-transparent hover:bg-white/[0.025]'
  } ${paid ? 'cursor-pointer' : 'cursor-not-allowed opacity-40'}`;

  const content = (
    <>
      <span className="flex min-w-0 flex-1 items-center gap-3 overflow-visible">
        <span
          aria-hidden="true"
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
            selected ? 'border-[var(--color-accent)]' : 'border-[var(--color-muted)]/60'
          }`}
        >
          <span className={`h-2 w-2 rounded-full transition ${selected ? 'bg-[var(--color-accent)]' : 'bg-transparent'}`} />
        </span>
        <span dir="rtl" className="min-w-0 flex-1 overflow-visible text-right">
          <span className="block whitespace-normal font-arabic text-base font-semibold leading-6 text-white">
            {product.name}
          </span>
          <span className="mt-1 block line-clamp-2 text-sm leading-6 text-[var(--color-muted)]">
            {product.shortDescription}
          </span>
        </span>
      </span>

      {paid ? (
        <span className="shrink-0 whitespace-nowrap text-right font-english text-sm font-bold text-[var(--color-accent)]">
          {priceLabelForPeriod(product, billingPeriod)}
        </span>
      ) : (
        <span className="shrink-0 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-bold text-[var(--color-muted)]">
          قريباً
        </span>
      )}
    </>
  );

  if (!paid) {
    return (
      <div dir="ltr" className={rowClassName} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      dir="ltr"
      onClick={onSelect}
      className={rowClassName}
    >
      {content}
    </button>
  );
}

export function PricingCheckout({ products }: { products: Product[] }) {
  const { addItem } = useCart();
  const [justAdded, setJustAdded] = useState(false);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>('monthly');
  const [user, setUser] = useState<{ discord_user_id: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard/me', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { success?: boolean; data?: { discord_user_id: string } } | null) => {
        if (j && j.success && j.data) setUser(j.data);
      })
      .catch(() => {})
      .finally(() => setAuthChecked(true));
  }, []);
  const firstPaid = useMemo(() => products.find(hasPaidPrice) ?? products[0], [products]);
  const [selectedKey, setSelectedKey] = useState(firstPaid?.key);

  useEffect(() => {
    const requestedProduct = new URLSearchParams(window.location.search).get('product');
    if (!requestedProduct) return;

    const matchingProduct = products.find((product) => product.key === requestedProduct && hasPaidPrice(product));
    if (matchingProduct) setSelectedKey(matchingProduct.key);
  }, [products]);
  const selectedProduct = products.find((product) => product.key === selectedKey) ?? firstPaid;
  const selectedPaid = selectedProduct ? hasPaidPrice(selectedProduct) : false;
  const selectedPriceLabel = selectedProduct ? priceLabelForPeriod(selectedProduct, billingPeriod) : '';
  const selectedDuration = durationForPeriod(billingPeriod);
  const paypalHref = selectedProduct ? paypalMeHref(selectedProduct, billingPeriod) : '/pricing';
  const paypalExternal = paypalHref.startsWith('http');
  const noteText = selectedProduct ? `${selectedProduct.name} - Opus Solutions - ${noteSuffix(billingPeriod)}` : '';

  function handleAddToCart() {
    if (!selectedProduct || !selectedPaid) return;
    addItem(buildCartItem(selectedProduct, billingPeriod === 'monthly' ? 'monthly' : '3_months'));
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 1500);
  }

  const payPalMeSteps = selectedProduct
    ? selectedProduct.manualActivation
      ? [
          'ادفع المبلغ عبر طريقة الدفع التي اخترتها',
          `اكتب في ملاحظة الدفع: "${noteText}"`,
          'احفظ رقم العملية (Transaction ID)',
          'افتح تكت في سيرفرنا وأرسل رقم العملية — ستستلم كود تفعيلك الخاص داخل التكت',
        ]
      : [
          'ادفع المبلغ عبر طريقة الدفع التي اخترتها',
          `اكتب في ملاحظة الدفع: "${noteText}"`,
          'احفظ رقم العملية (Transaction ID)',
          'افتح تكت في سيرفرنا وأرسل رقم العملية',
        ]
    : [];

  return (
    <div dir="rtl" className="grid gap-8">
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 text-center">
          <p className="font-arabic text-lg font-extrabold text-[var(--color-text)]">اختر مدة الاشتراك</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">تقدر تدفع شهريًا أو تختار 3 شهور بسعر أوفر.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setBillingPeriod('monthly')}
            className={`rounded-2xl border px-4 py-3 text-center font-arabic transition ${
              billingPeriod === 'monthly'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-black shadow-[0_0_28px_rgba(255,138,0,0.22)]'
                : 'border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="block text-base font-extrabold">شهري</span>
            <span className={`mt-1 block text-xs ${billingPeriod === 'monthly' ? 'text-black/70' : 'text-[var(--color-muted)]'}`}>
              دفع كل شهر
            </span>
          </button>

          <button
            type="button"
            onClick={() => setBillingPeriod('quarterly')}
            className={`relative rounded-2xl border px-4 py-3 text-center font-arabic transition ${
              billingPeriod === 'quarterly'
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-black shadow-[0_0_28px_rgba(255,138,0,0.22)]'
                : 'border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]'
            }`}
          >
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--color-accent-2)] px-3 py-1 text-[11px] font-extrabold text-[var(--color-bg)] shadow-[0_0_18px_rgba(255,138,0,0.22)]">
              وفّر 5%
            </span>
            <span className="block text-base font-extrabold">3 شهور</span>
            <span className={`mt-1 block text-xs ${billingPeriod === 'quarterly' ? 'text-black/70' : 'text-[var(--color-muted)]'}`}>
              دفعة واحدة كل 3 شهور
            </span>
          </button>
        </div>
      </div>

      <section className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-4 text-right font-arabic text-xl font-extrabold text-[var(--color-text)]">اختر المنتج</h2>
        <div className="max-h-80 overflow-y-auto rounded-xl border border-[var(--color-border)]">
          {products.map((product) => (
            <ProductRow
              key={product.key}
              product={product}
              selected={selectedProduct?.key === product.key}
              billingPeriod={billingPeriod}
              onSelect={() => setSelectedKey(product.key)}
            />
          ))}
        </div>
      </section>

      <section className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:p-5">
        {selectedProduct ? (
          <>
            <div className="mb-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
              <p className="text-xs font-bold text-[var(--color-accent-2)]">المنتج المحدد</p>
              <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-arabic text-2xl font-extrabold text-[var(--color-text)]">{selectedProduct.name}</h2>
                  <p className="mt-2 text-sm text-[var(--color-muted)]">الخطة: {periodLabel(billingPeriod)}</p>
                </div>
                <p className="font-english text-3xl font-extrabold text-[var(--color-text)]">{selectedPriceLabel}</p>
              </div>
              {selectedPaid ? (
                <button
                  type="button"
                  onClick={handleAddToCart}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--color-accent)] px-5 py-3 font-arabic text-sm font-extrabold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-black"
                >
                  {justAdded ? <Check size={17} /> : <ShoppingCart size={17} />}
                  <span>{justAdded ? 'تمت الإضافة للسلة' : 'أضف للسلة'}</span>
                </button>
              ) : null}
            </div>

            {selectedPaid ? (
              !authChecked ? (
                <div className="flex items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-8 font-arabic text-sm text-[var(--color-muted)]">
                  جاري التحقق...
                </div>
              ) : !user ? (
                <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6 text-center">
                  <p className="font-arabic text-base font-bold text-[var(--color-text)]">سجّل دخولك أولاً لإتمام الشراء</p>
                  <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
                    لازم تربط حساب Discord قبل الدفع — حتى التحويل عبر PayPal.me — عشان نربط اشتراكك ببوتك تلقائياً ويوصلك فوراً.
                  </p>
                  <a
                    href="/api/auth/discord"
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-6 py-3 font-arabic text-sm font-extrabold text-white transition hover:opacity-90"
                  >
                    تسجيل الدخول عبر Discord
                  </a>
                </div>
              ) : (
              <div className="grid gap-0">
                <div className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-6">
                  <div className="mb-5">
                    <p className="font-arabic text-lg font-extrabold text-[var(--color-text)]">تحويل مباشر عبر PayPal.me</p>
                    <p className="mt-1 text-sm leading-7 text-[var(--color-muted)]">لا تحتاج حساب PayPal — ادفع مباشرة كـ Send</p>
                  </div>
                  <a
                    href={paypalHref}
                    target={paypalExternal ? '_blank' : undefined}
                    rel={paypalExternal ? 'noopener noreferrer' : undefined}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#0070ba] bg-transparent px-5 py-3 font-arabic text-sm font-extrabold text-[#0070ba] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-[#0070ba]"
                  >
                    <Send size={17} />
                    <span>ادفع عبر PayPal.me</span>
                  </a>
                </div>

                <div className="my-6 flex w-full items-center gap-3 text-[var(--color-muted)]" aria-hidden="true">
                  <span className="h-px flex-1 bg-[var(--color-border)]" />
                  <span className="font-arabic text-sm font-bold">أو</span>
                  <span className="h-px flex-1 bg-[var(--color-border)]" />
                </div>

                <ProductPayPalCheckout
                  productId={selectedProduct.id}
                  productSlug={selectedProduct.key}
                  productName={selectedProduct.name}
                  priceLabel={selectedPriceLabel}
                  planId={billingPeriod}
                  duration={selectedDuration}
                />

                <div className="mt-6 w-full rounded-xl border border-[#334155] bg-[rgba(255,255,255,0.03)] p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 size={18} className="text-[#60a5fa]" />
                    <p className="font-arabic text-sm font-extrabold text-[var(--color-text)]">بعد إتمام الدفع</p>
                  </div>
                  <ol className="mt-3 grid gap-2 text-sm leading-7 text-[#94a3b8]">
                    {payPalMeSteps.map((step, index) => (
                      <li key={step} className="flex items-start gap-3">
                        <span className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#60a5fa] font-english text-[11px] font-bold leading-none text-white">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
              )
            ) : (
              <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 text-center">
                <p className="font-arabic text-xl font-extrabold text-[var(--color-text)]">قريباً</p>
                <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">هذا المنتج غير متاح للدفع حاليًا، وبيتم فتحه قريبًا.</p>
              </div>
            )}
          </>
        ) : null}
      </section>
    </div>
  );
}
