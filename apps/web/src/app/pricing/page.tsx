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

        <PricingCheckout products={visibleProducts} />
      </section>
    </PublicFrame>
  );
}
