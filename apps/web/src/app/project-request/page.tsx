import { LockKeyhole, MessageCircle } from 'lucide-react';
import { ProjectRequestsClient } from '@/components/ProjectRequestsClient';
import { PublicFrame } from '@/components/ui';
import { getSession } from '@/lib/sessions';

export const dynamic = 'force-dynamic';

export default async function ProjectRequestPage() {
  const session = await getSession();

  return (
    <PublicFrame>
      <div dir="rtl" className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-english text-xs font-bold uppercase tracking-[0.2em] text-opus-accent">Custom Project</p>
          <h1 className="mt-2 font-arabic text-3xl font-extrabold text-opus-text sm:text-4xl">اطلب مشروعك</h1>
          <p className="mt-3 max-w-2xl font-arabic text-sm leading-7 text-opus-muted">شاركنا فكرتك، ثم تابع التفاصيل والردود في محادثة خاصة من نفس الصفحة.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 font-arabic text-xs font-bold text-emerald-300"><LockKeyhole size={14} /> بيانات مشفّرة</span>
      </div>

      {session ? <ProjectRequestsClient /> : (
        <section dir="rtl" className="opus-card mx-auto max-w-2xl p-8 text-center sm:p-12">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#5865F2]/15 text-[#8c95ff]"><MessageCircle size={26} /></span>
          <h2 className="mt-5 font-arabic text-xl font-extrabold text-opus-text">سجّل دخولك لبدء الطلب</h2>
          <p className="mx-auto mt-2 max-w-md font-arabic text-sm leading-7 text-opus-muted">نستخدم حساب Discord لحماية محادثتك والتأكد أن رسائلك لا تظهر إلا لك ولمالك المتجر.</p>
          <a href="/api/auth/discord" className="mt-6 inline-flex rounded-xl bg-[#5865F2] px-6 py-3 font-arabic text-sm font-extrabold text-white transition hover:opacity-90">تسجيل الدخول عبر Discord</a>
        </section>
      )}
    </PublicFrame>
  );
}
