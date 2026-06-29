'use client';

import { motion } from 'framer-motion';
import { getPayPalHrefFromPriceLabel } from '@/lib/site-content';

type PaymentSectionProps = {
  priceLabel: string;
  productName: string;
};

export function PaymentSection({ priceLabel, productName }: PaymentSectionProps) {
  const paypalUrl = getPayPalHrefFromPriceLabel(priceLabel);
  const isExternal = paypalUrl.startsWith('http');
  const instructions = [
    'ادفع المبلغ عبر الباي بال',
    `اكتب في ملاحظة الدفع اسم المنتج: ${productName}`,
    'احفظ رقم العملية (Transaction ID)',
    'افتح تكت في سيرفرنا وارسل رقم العملية',
  ];

  return (
    <motion.section
      dir="rtl"
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 text-right"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--color-accent)]">الدفع عبر PayPal</p>
          <h3 className="mt-1 font-arabic text-lg font-extrabold text-[var(--color-text)]">{productName}</h3>
          <p className="mt-2 text-sm leading-7 text-[var(--color-muted)]">
            استخدم زر الباي بال ثم اتبع التعليمات لإكمال تفعيل المنتج.
          </p>
        </div>

        <a
          href={paypalUrl}
          target={isExternal ? '_blank' : undefined}
          rel={isExternal ? 'noopener noreferrer' : undefined}
          className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-black transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          aria-label={`ادفع عبر الباي بال لشراء ${productName}`}
        >
          ادفع {priceLabel} عبر الباي بال
        </a>
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <p className="text-sm font-bold text-[var(--color-text)]">تعليمات بعد الدفع</p>
        <ol className="mt-3 grid gap-2 text-sm leading-7 text-[var(--color-muted)]">
          {instructions.map((instruction, index) => (
            <li key={instruction} className="flex items-start gap-2">
              <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[11px] font-bold text-[var(--color-accent)]">
                {index + 1}
              </span>
              <span>{instruction}</span>
            </li>
          ))}
        </ol>
      </div>
    </motion.section>
  );
}
