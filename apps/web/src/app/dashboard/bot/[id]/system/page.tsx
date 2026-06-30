import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { WelcomeEditor } from '@/components/dashboard/WelcomeEditor';

export const dynamic = 'force-dynamic';

export default async function SystemBotDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const bot = await assertOwnedBot(session.discordUserId, id);
  if (!bot) notFound();
  if (bot.product_type !== 'general') redirect('/dashboard');

  return (
    <main dir="rtl" className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-arabic text-2xl font-extrabold text-opus-text">لوحة السيستم — {bot.bot_name || 'SystemBot'}</h1>
          <p className="mt-1 font-arabic text-sm text-opus-muted">تحكّم في ميزات بوت السيستم لسيرفرك.</p>
        </div>
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-opus-border px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent">
          <ArrowRight size={15} /> رجوع
        </Link>
      </div>

      <div className="mt-6 grid gap-5">
        <WelcomeEditor botId={id} />

        <div className="rounded-2xl border border-dashed border-opus-border bg-opus-surface p-5 text-center">
          <p className="font-arabic text-sm font-bold text-opus-text">قريباً: صورة الترحيب + الاختصارات</p>
          <p className="mt-1 font-arabic text-xs text-opus-muted">محرّر صورة ترحيب بصري وأوامر مخصّصة بالعربي.</p>
        </div>
      </div>
    </main>
  );
}
