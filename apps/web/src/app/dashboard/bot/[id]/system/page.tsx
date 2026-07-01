import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Hash, Image as ImageIcon, MessageSquare, Sparkles } from 'lucide-react';
import { getSession } from '@/lib/sessions';
import { assertOwnedBot } from '@/lib/dashboard-data';
import { WelcomeEditor } from '@/components/dashboard/WelcomeEditor';
import { AliasEditor } from '@/components/dashboard/AliasEditor';
import { WelcomeImageEditor } from '@/components/dashboard/WelcomeImageEditor';
import { CommandPermissionsEditor } from '@/components/dashboard/CommandPermissionsEditor';

export const dynamic = 'force-dynamic';

const quickCards = [
  { icon: MessageSquare, title: 'رسالة الترحيب', text: 'اختيار الروم من القائمة + متغيرات جاهزة.' },
  { icon: ImageIcon, title: 'صورة الترحيب', text: 'اسحب الأفاتار والاسم فوق الخلفية مباشرة.' },
  { icon: Hash, title: 'صلاحيات الأوامر', text: 'تحكم بمن يستخدم ban/kick وكل أوامر السيستم.' },
];

export default async function SystemBotDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect('/login');
  const bot = await assertOwnedBot(session.discordUserId, id);
  if (!bot) notFound();
  if (bot.product_type !== 'general') redirect('/dashboard');

  return (
    <main dir="rtl" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <section className="overflow-hidden rounded-3xl border border-opus-border bg-[radial-gradient(circle_at_top_right,rgba(221,255,0,0.12),transparent_35%),var(--color-surface)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-opus-accent/40 bg-opus-accent/10 px-3 py-1 font-arabic text-xs font-extrabold text-opus-accent">
              <Sparkles size={13} /> لوحة السيستم المتقدمة
            </span>
            <h1 className="mt-4 font-arabic text-2xl font-extrabold text-opus-text sm:text-3xl">{bot.bot_name || 'SystemBot'}</h1>
            <p className="mt-2 max-w-2xl font-arabic text-sm leading-7 text-opus-muted">تحكّم في الترحيب، صورة الدخول، واختصارات الأوامر من مكان واحد بشكل مرتب وواضح.</p>
          </div>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-opus-border bg-opus-bg/50 px-4 py-2 font-arabic text-sm font-bold text-opus-text transition hover:border-opus-accent">
            <ArrowRight size={15} /> رجوع
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {quickCards.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-opus-border bg-opus-bg/45 p-4">
              <Icon size={18} className="text-opus-accent-2" />
              <p className="mt-3 font-arabic text-sm font-extrabold text-opus-text">{title}</p>
              <p className="mt-1 font-arabic text-[11px] leading-5 text-opus-muted">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="mt-6 grid gap-5">
        <WelcomeEditor botId={id} />

        <WelcomeImageEditor botId={id} />

        <CommandPermissionsEditor botId={id} />

        <AliasEditor botId={id} />
      </div>
    </main>
  );
}
