import { CalendarDays, GraduationCap, LayoutDashboard, Lightbulb, PanelsTopLeft, Smartphone } from 'lucide-react';
import { ProjectRequestBackdrop } from '@/components/ProjectRequestBackdrop';
import { ProjectRequestsClient } from '@/components/ProjectRequestsClient';
import { MotionSection } from '@/components/MotionSection';
import { PublicFrame } from '@/components/ui';
import { WelcomeScene3D } from '@/components/WelcomeScene3D';

export const dynamic = 'force-dynamic';

const serviceTypes = [
  [GraduationCap, 'مشاريع الطلاب'],
  [Lightbulb, 'مشاريع عامة'],
  [PanelsTopLeft, 'مواقع'],
  [CalendarDays, 'أنظمة حجوزات'],
  [LayoutDashboard, 'لوحات تحكم'],
  [Smartphone, 'تطبيقات وأدوات'],
] as const;

export default async function ProjectRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ for?: string }>;
}) {
  const audience = (await searchParams).for;
  const heading = audience === 'student'
    ? 'خلّ مشروعك الجامعي يطلع بأفضل صورة'
    : audience === 'business'
      ? 'فكرتك جاهزة تتحول إلى مشروع حقيقي'
      : 'عندك فكرة وتبي تحوّلها إلى مشروع؟';
  const description = audience === 'student'
    ? 'اشرح لنا المطلوب وموعد التسليم، وسنرتّب معك نطاق المشروع وخطوات تنفيذه بشكل واضح.'
    : 'اشرح فكرتك لنا، وسنراجع المتطلبات ونرسل لك التفاصيل والتكلفة قبل بدء العمل.';

  return (
    <PublicFrame>
      <ProjectRequestBackdrop />
      <MotionSection className="relative mx-auto mb-10 max-w-6xl pt-4 sm:pt-10">
        <div dir="rtl" className="grid items-center gap-6 lg:grid-cols-[1.08fr_0.92fr]">
          <div className="text-center lg:text-right">
            <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">مساحة فكرتك تبدأ هنا</p>
            <h1 className="mt-3 text-balance font-arabic text-3xl font-extrabold leading-tight text-[var(--color-text)] sm:text-5xl">{heading}</h1>
            <p className="mt-4 max-w-2xl text-balance font-arabic text-base leading-8 text-[var(--color-muted)] sm:text-lg">{description}</p>
            <p className="mt-1 max-w-xl font-arabic text-sm leading-7 text-[var(--color-accent-2)]">لا تحتاج معرفة تقنية — فقط اشرح ما الذي تريد أن يفعله مشروعك.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start">
              {serviceTypes.map(([Icon, label]) => (
                <span key={label} className="inline-flex items-center gap-2 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]/70 px-3.5 py-2 font-arabic text-xs font-bold text-[var(--color-muted)] transition hover:-translate-y-0.5 hover:border-[var(--color-accent)]/40 hover:text-[var(--color-text)]">
                  <Icon size={13} className="text-[var(--color-accent)]" />
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div className="pointer-events-none h-72 sm:h-80 lg:h-[420px]" aria-hidden="true">
            <WelcomeScene3D variant="project" />
          </div>
        </div>
      </MotionSection>
      <div className="relative">
        <ProjectRequestsClient />
      </div>
    </PublicFrame>
  );
}
