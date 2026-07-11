import { Bot, CalendarDays, LayoutDashboard, PanelsTopLeft, Smartphone } from 'lucide-react';
import { ProjectRequestBackdrop } from '@/components/ProjectRequestBackdrop';
import { ProjectRequestsClient } from '@/components/ProjectRequestsClient';
import { PublicFrame } from '@/components/ui';

export const dynamic = 'force-dynamic';

const serviceTypes = [
  [PanelsTopLeft, 'مواقع'],
  [CalendarDays, 'أنظمة حجوزات'],
  [LayoutDashboard, 'لوحات تحكم'],
  [Smartphone, 'تطبيقات وأدوات'],
  [Bot, 'بوتات Discord'],
] as const;

export default function ProjectRequestPage() {
  return (
    <PublicFrame>
      <ProjectRequestBackdrop />
      <section dir="rtl" className="relative mx-auto mb-10 max-w-4xl pt-5 text-center sm:pt-10">
        <span className="inline-flex rounded-full border border-opus-accent/25 bg-opus-accent/10 px-4 py-2 font-arabic text-xs font-extrabold text-opus-accent-2">مشروع مخصص</span>
        <h1 className="mt-5 text-balance font-arabic text-4xl font-extrabold leading-tight text-opus-text sm:text-6xl">عندك فكرة موقع، نظام أو برنامج؟</h1>
        <p className="mx-auto mt-5 max-w-3xl text-balance font-arabic text-base leading-8 text-opus-muted sm:text-lg">اشرح فكرتك لنا، وسنراجع المتطلبات ونرسل لك التفاصيل والتكلفة قبل بدء العمل.</p>
        <p className="mx-auto mt-2 max-w-2xl font-arabic text-sm leading-7 text-opus-accent-2">لا تحتاج معرفة تقنية — فقط اشرح ما الذي تريد أن يفعله مشروعك.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {serviceTypes.map(([Icon, label]) => <span key={label} className="inline-flex items-center gap-2 rounded-full border border-opus-border bg-opus-surface/70 px-3 py-2 font-arabic text-xs font-bold text-opus-muted backdrop-blur"><Icon size={14} className="text-opus-accent" />{label}</span>)}
        </div>
      </section>
      <div className="relative">
        <ProjectRequestsClient />
      </div>
    </PublicFrame>
  );
}
