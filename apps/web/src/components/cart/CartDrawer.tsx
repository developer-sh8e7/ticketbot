'use client';

import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingCart, Trash2, X } from 'lucide-react';
import { useCart, type CartDuration } from './CartProvider';

const durationLabel: Record<CartDuration, string> = {
  monthly: 'شهري',
  '3_months': '3 شهور',
};

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, setDuration, totalLabel, clear } = useCart();

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={closeCart}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          <motion.aside
            dir="rtl"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'tween', duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-y-0 right-0 z-[61] flex h-full w-full max-w-md flex-col border-l border-opus-border bg-opus-bg shadow-2xl"
            role="dialog"
            aria-label="سلة المشتريات"
          >
            <header className="flex items-center justify-between border-b border-opus-border px-5 py-4">
              <div className="flex items-center gap-2">
                <ShoppingCart size={20} className="text-opus-accent" />
                <h2 className="font-arabic text-lg font-extrabold text-opus-text">سلة المشتريات</h2>
                <span className="rounded-full bg-opus-accent/15 px-2 py-0.5 font-english text-xs font-bold text-opus-accent">
                  {items.length}
                </span>
              </div>
              <button
                type="button"
                onClick={closeCart}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-opus-border text-opus-muted transition hover:border-opus-accent hover:text-opus-text"
                aria-label="إغلاق"
              >
                <X size={18} />
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
                  <ShoppingCart size={44} className="text-opus-muted/50" />
                  <p className="font-arabic text-base font-bold text-opus-text">سلتك فارغة</p>
                  <p className="text-sm text-opus-muted">أضف منتجاً للبدء.</p>
                  <Link
                    href="/bots#prices"
                    onClick={closeCart}
                    className="mt-2 rounded-xl border border-opus-accent px-4 py-2 font-arabic text-sm font-bold text-opus-accent transition hover:bg-opus-accent hover:text-black"
                  >
                    تصفّح المنتجات
                  </Link>
                </div>
              ) : (
                <ul className="grid gap-3">
                  {items.map((item) => (
                    <li key={item.key} className="rounded-2xl border border-opus-border bg-opus-surface p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-arabic text-base font-bold text-opus-text">{item.name}</p>
                          <p className="mt-1 font-english text-sm font-bold text-opus-accent-2">
                            ${item.amount.toFixed(2)}
                            <span className="text-opus-muted"> / {durationLabel[item.duration]}</span>
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-opus-border text-opus-muted transition hover:border-red-500/60 hover:text-red-400"
                          aria-label="حذف"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {(['monthly', '3_months'] as CartDuration[]).map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => setDuration(item.key, d)}
                            className={`rounded-xl border px-3 py-2 font-arabic text-xs font-bold transition ${
                              item.duration === d
                                ? 'border-opus-accent bg-opus-accent/10 text-opus-text'
                                : 'border-opus-border text-opus-muted hover:border-opus-accent/60'
                            }`}
                          >
                            {durationLabel[d]}
                          </button>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {items.length > 0 ? (
              <footer className="border-t border-opus-border px-5 py-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-arabic text-sm text-opus-muted">الإجمالي</span>
                  <span className="font-english text-xl font-extrabold text-opus-text">{totalLabel}</span>
                </div>
                <Link
                  href="/cart"
                  onClick={closeCart}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-opus-accent px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90"
                >
                  إتمام الشراء
                </Link>
                <button
                  type="button"
                  onClick={clear}
                  className="mt-2 inline-flex w-full items-center justify-center rounded-xl px-5 py-2 font-arabic text-xs font-bold text-opus-muted transition hover:text-opus-text"
                >
                  تفريغ السلة
                </button>
              </footer>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
