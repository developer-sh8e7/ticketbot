import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/sessions';
import { sessionIsOwner } from '@/lib/owner';
import { getSubscribers, getPoolBots } from '@/lib/admin-data';
import { OwnerBotsManager } from '@/components/dashboard/OwnerBotsManager';
import { StoredBotsPanel } from '@/components/dashboard/StoredBotsPanel';

export const dynamic = 'force-dynamic';

export default async function OwnerBotsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!sessionIsOwner(session)) redirect('/dashboard');

  const [bots, pool] = await Promise.all([getSubscribers(500), getPoolBots()]);

  return (
    <main dir="rtl" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-arabic text-2xl font-extrabold text-opus-text">إدارة كل البوتات</h1>
          <p className="mt-1 font-arabic text-sm text-opus-muted">بوتاتك المخزّنة والجاهزة، وبوتات العملاء الفعّالة — كلها من مكان واحد.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent">
          <ArrowRight size={15} /> رجوع للوحة
        </Link>
      </div>

      <section className="mt-8">
        <div className="mb-4">
          <h2 className="font-arabic text-lg font-extrabold text-opus-text">البوتات المخزّنة (توكنات جاهزة)</h2>
          <p className="mt-1 font-arabic text-xs text-opus-muted">
            كل توكن أضفته — حتى قبل أن يشتريه أحد. أضِف البوت لسيرفر أو شغّله مباشرة؛ ولو اشترك عميل لاحقاً يكمل على نفس النسخة.
          </p>
        </div>
        <StoredBotsPanel bots={pool} />
      </section>

      <section className="mt-10">
        <h2 className="mb-4 font-arabic text-lg font-extrabold text-opus-text">بوتات العملاء الفعّالة</h2>
        <OwnerBotsManager bots={bots} />
      </section>
    </main>
  );
}
