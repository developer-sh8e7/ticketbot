import { Bot, CalendarDays, LayoutDashboard, PanelsTopLeft, Smartphone, Sparkles } from 'lucide-react';
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
        <span className="group inline-flex items-center gap-2 rounded-full border border-opus-accent/30 bg-opus-accent/10 px-5 py-2 font-arabic text-xs font-extrabold text-opus-accent-2 shadow-[0_0_30px_rgba(255,138,0,0.08)] transition hover:border-opus-accent/60 hover:shadow-[0_0_40px_rgba(255,138,0,0.15)]">
          <Sparkles size={14} className="transition group-hover:scale-110" />
          مشروع مخصص
        </span>
        <h1 className="mt-6 text-balance font-arabic text-4xl font-extrabold leading-tight sm:text-6xl">
          <span className="project-gradient-text">عندك فكرة موقع، نظام أو برنامج؟</span>
        </h1>
        <p className="mx-auto mt-5 max-w-3xl text-balance font-arabic text-base leading-8 text-opus-muted sm:text-lg">اشرح فكرتك لنا، وسنراجع المتطلبات ونرسل لك التفاصيل والتكلفة قبل بدء العمل.</p>
        <p className="mx-auto mt-2 max-w-2xl font-arabic text-sm leading-7 text-opus-accent-2">لا تحتاج معرفة تقنية — فقط اشرح ما الذي تريد أن يفعله مشروعك.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {serviceTypes.map(([Icon, label]) => (
            <span key={label} className="project-service-badge inline-flex items-center gap-2 rounded-full border border-opus-border/60 bg-opus-surface/60 px-4 py-2.5 font-arabic text-xs font-bold text-opus-muted backdrop-blur-sm transition hover:border-opus-accent/40 hover:text-opus-text hover:bg-opus-accent/5 hover:shadow-[0_0_25px_rgba(255,138,0,0.06)]">
              <Icon size={14} className="text-opus-accent transition group-hover:scale-110" />
              {label}
            </span>
          ))}
        </div>
      </section>
      <div className="relative">
        <ProjectRequestsClient />
      </div>
    </PublicFrame>
  );
}
