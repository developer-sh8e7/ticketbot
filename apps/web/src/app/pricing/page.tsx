import Link from 'next/link';
import { ArrowLeft, Code2 } from 'lucide-react';
import { PricingCheckout } from '@/components/PricingCheckout';
import { PublicFrame } from '@/components/ui';
import { products } from '@/lib/site-content';

export default function PricingPage() {
  const visibleProducts = products().filter((product) => product.key !== 'custom');

  return (
    <PublicFrame>
      <section dir="rtl" className="mx-auto max-w-2xl px-6 py-12 md:px-0 md:py-16">
        <div className="mb-12 text-center">
          <h1 className="mb-8 font-arabic text-[2.5rem] font-extrabold leading-tight tracking-tight text-white">الأسعار</h1>
          <p className="mx-auto max-w-2xl font-arabic text-base leading-8 text-[var(--color-muted)]">
            اختر المنتج، ثم اختر طريقة الدفع المناسبة لك من مكان واحد.
          </p>
        </div>

        <article className="relative mb-8 overflow-hidden rounded-2xl border border-opus-accent/30 bg-opus-surface p-6 shadow-[0_24px_70px_-35px_rgba(255,138,0,0.4)]">
          <div className="absolute -left-16 -top-16 h-40 w-40 rounded-full bg-opus-accent/10 blur-3xl" aria-hidden="true" />
          <div className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-opus-accent/10 text-opus-accent"><Code2 size={23} /></span>
            <h2 className="mt-5 font-arabic text-2xl font-extrabold text-opus-text">مشروع مخصص</h2>
            <p className="mt-3 font-arabic text-sm leading-7 text-opus-muted">عندك فكرة موقع، نظام، برنامج أو بوت؟ أرسل التفاصيل ونحدد السعر بعد مراجعة المتطلبات.</p>
            <p className="mt-4 font-arabic text-lg font-extrabold text-opus-accent-2">السعر حسب المتطلبات</p>
            <Link href="/project-request" className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-opus-accent px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5">
              اطلب مشروعك <ArrowLeft size={16} />
            </Link>
          </div>
        </article>

        <PricingCheckout products={visibleProducts} />
      </section>
    </PublicFrame>
  );
}
