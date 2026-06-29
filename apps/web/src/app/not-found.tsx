import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <span className="text-7xl font-extrabold tracking-tighter text-opus-accent">404</span>
      <h1 className="max-w-md text-2xl font-extrabold text-opus-text">الصفحة غير موجودة</h1>
      <p className="max-w-sm text-sm leading-7 text-opus-muted">الرابط غير صحيح أو الصفحة أزيلت.</p>
      <Link href="/" className="rounded-xl border border-opus-border bg-opus-accent px-5 py-2.5 text-sm font-semibold text-black hover:opacity-90">العودة للرئيسية</Link>
    </div>
  );
}
