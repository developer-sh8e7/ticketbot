import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/sessions';
import { sessionIsOwner } from '@/lib/owner';
import { getSubscribers } from '@/lib/admin-data';
import { OwnerBotsManager } from '@/components/dashboard/OwnerBotsManager';

export const dynamic = 'force-dynamic';

export default async function OwnerBotsPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (!sessionIsOwner(session)) redirect('/dashboard');

  const bots = await getSubscribers(500);

  return (
    <main dir="rtl" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-arabic text-2xl font-extrabold text-opus-text">إدارة كل البوتات</h1>
          <p className="mt-1 font-arabic text-sm text-opus-muted">كل بوتات العملاء — نشط، منتهي، موقوف أو قرب الانتهاء. مدّد أو أوقف أو فعّل أيّ بوت.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent">
          <ArrowRight size={15} /> رجوع للوحة
        </Link>
      </div>

      <div className="mt-6">
        <OwnerBotsManager bots={bots} />
      </div>
    </main>
  );
}
