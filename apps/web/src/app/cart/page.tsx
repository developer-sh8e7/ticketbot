import { PublicFrame } from '@/components/ui';
import { CartCheckout } from '@/components/CartCheckout';

export const metadata = {
  title: 'السلة',
};

export default function CartPage() {
  return (
    <PublicFrame>
      <section dir="rtl" className="mx-auto max-w-3xl px-2 py-8 md:py-12">
        <div className="mb-8 text-center">
          <h1 className="font-arabic text-[2.25rem] font-extrabold leading-tight tracking-tight text-opus-text">
            إتمام الشراء
          </h1>
          <p className="mx-auto mt-3 max-w-xl font-arabic text-sm leading-7 text-opus-muted">
            راجع سلتك، سجّل دخولك عبر Discord، ثم ادفع عبر PayPal/البطاقة أو التحويل اليدوي.
          </p>
        </div>
        <CartCheckout />
      </section>
    </PublicFrame>
  );
}
