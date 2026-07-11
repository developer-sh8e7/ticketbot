import { ProjectRequestsClient } from '@/components/ProjectRequestsClient';
import { PublicFrame } from '@/components/ui';

export const dynamic = 'force-dynamic';

export default function ProjectRequestPage() {
  return (
    <PublicFrame>
      <div dir="rtl" className="mb-8">
        <p className="font-english text-xs font-bold uppercase tracking-[0.2em] text-opus-accent">Custom Project</p>
        <h1 className="mt-2 font-arabic text-3xl font-extrabold text-opus-text sm:text-4xl">اطلب مشروعك</h1>
        <p className="mt-3 max-w-2xl font-arabic text-sm leading-7 text-opus-muted">شاركنا فكرتك، ثم تابع التفاصيل والردود في محادثة خاصة من نفس الصفحة.</p>
      </div>
      <ProjectRequestsClient />
    </PublicFrame>
  );
}
