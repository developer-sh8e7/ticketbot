import { Bot, CalendarDays, GraduationCap, LayoutDashboard, Lightbulb, PanelsTopLeft, Smartphone } from 'lucide-react';
import { ProjectRequestBackdrop } from '@/components/ProjectRequestBackdrop';
import { ProjectRequestsClient } from '@/components/ProjectRequestsClient';
import { PublicFrame } from '@/components/ui';

export const dynamic = 'force-dynamic';

const serviceTypes = [
  [GraduationCap, 'مشاريع الطلاب'],
  [Lightbulb, 'مشاريع عامة'],
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
      <section dir="rtl" className="relative mx-auto mb-8 max-w-4xl pt-8 text-center sm:pt-14">
        <h1 className="text-balance font-arabic text-3xl font-extrabold leading-tight text-[var(--color-text)] sm:text-5xl">
          عندك فكرة موقع، نظام أو برنامج؟
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-balance font-arabic text-base leading-8 text-[var(--color-muted)] sm:text-lg">
          اشرح فكرتك لنا، وسنراجع المتطلبات ونرسل لك التفاصيل والتكلفة قبل بدء العمل.
        </p>
        <p className="mx-auto mt-1 max-w-xl font-arabic text-sm leading-7 text-[var(--color-accent-2)]">
          لا تحتاج معرفة تقنية — فقط اشرح ما الذي تريد أن يفعله مشروعك.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {serviceTypes.map(([Icon, label]) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3.5 py-2 font-arabic text-xs font-bold text-[var(--color-muted)] transition hover:border-[var(--color-accent)]/30 hover:text-[var(--color-text)]"
            >
              <Icon size={13} className="text-[var(--color-accent)]" />
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
