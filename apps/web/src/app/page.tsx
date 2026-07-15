import Link from 'next/link';
import {
  BriefcaseBusiness,
  Check,
  ClipboardCheck,
  GraduationCap,
  Headphones,
  LayoutTemplate,
  LifeBuoy,
  ListChecks,
  Network,
  PanelsTopLeft,
  Rocket,
  TimerReset,
  UsersRound,
  Workflow,
} from 'lucide-react';
import { HomeHero } from '@/components/HomeHero';
import { GeometricBanner } from '@/components/GeometricBanner';
import { MotionGrid } from '@/components/MotionGrid';
import { MotionSection } from '@/components/MotionSection';
import { PublicFrame } from '@/components/ui';
import { WelcomeIntro } from '@/components/WelcomeIntro';

const audiences = [
  {
    icon: GraduationCap,
    banner: 'student' as const,
    title: 'للطلاب',
    description: 'نحوّل فكرة مشروعك الجامعي أو مشروع التخرج إلى نموذج عملي واضح وجاهز للعرض.',
    points: ['مواقع ومشاريع تخرج', 'نماذج أولية قابلة للتجربة', 'واجهات ولوحات عرض مرتبة'],
  },
  {
    icon: LayoutTemplate,
    banner: 'general' as const,
    title: 'للمشاريع العامة',
    description: 'موقع أو نظام أو أداة رقمية تُبنى حول فكرتك، سواء كانت بسيطة أو تحتاج مراحل متعددة.',
    points: ['مواقع تعريفية وخدمية', 'منصات خدمات وطلبات', 'لوحات تحكم وأدوات داخلية'],
  },
  {
    icon: BriefcaseBusiness,
    banner: 'business' as const,
    title: 'للأعمال',
    description: 'حلول رقمية تساعد نشاطك على تنظيم العمل وتقديم تجربة أفضل لعملائك.',
    points: ['أتمتة المهام المتكررة', 'إدارة العملاء والطلبات', 'تطوير وتوسّع حسب الحاجة'],
  },
] as const;

const workflow = [
  {
    icon: ClipboardCheck,
    banner: 'plan' as const,
    title: 'نرتّب الفكرة معك',
    description: 'نراجع الهدف والمتطلبات ونحوّلها إلى نطاق عمل واضح قبل البدء.',
  },
  {
    icon: LayoutTemplate,
    banner: 'build' as const,
    title: 'نصمم ونطوّر',
    description: 'نبني تجربة مرتبة وسهلة الاستخدام تناسب طبيعة مشروعك وجمهوره.',
  },
  {
    icon: Headphones,
    banner: 'launch' as const,
    title: 'نسلّم وندعم',
    description: 'تستلم مشروعاً جاهزاً مع توضيح طريقة استخدامه ودعم حسب الاتفاق.',
  },
] as const;

const deliverables = [
  { icon: ListChecks, banner: 'scope' as const, title: 'خطة واضحة', description: 'تعرف من البداية ما الذي سنبنيه وما الذي ستستلمه.' },
  { icon: PanelsTopLeft, banner: 'experience' as const, title: 'تجربة مرتبة', description: 'واجهة مفهومة مصممة حول المستخدم والهدف الحقيقي للمشروع.' },
  { icon: Rocket, banner: 'delivery' as const, title: 'إطلاق فعلي', description: 'لا نقف عند التصميم؛ نجهّز المشروع ليعمل ويصل لمستخدميه.' },
  { icon: LifeBuoy, banner: 'support' as const, title: 'دعم بعد التسليم', description: 'نوضح لك طريقة الاستخدام ونبقى معك حسب اتفاق المشروع.' },
] as const;

const pricingFactors = [
  { icon: Workflow, title: 'نطاق المشروع', description: 'عدد الصفحات والوظائف والعمليات المطلوبة.' },
  { icon: Network, title: 'الربط والتكاملات', description: 'الدفع، الرسائل، الأنظمة الخارجية وأي خدمات مرتبطة.' },
  { icon: UsersRound, title: 'حجم الاستخدام', description: 'عدد المستخدمين والصلاحيات وطبيعة التشغيل.' },
  { icon: TimerReset, title: 'المدة المطلوبة', description: 'الجدول الزمني ومراحل التسليم المناسبة للمشروع.' },
] as const;

export default function HomePage() {
  return (
    <>
      <WelcomeIntro />
      <PublicFrame>
        <HomeHero />

        <MotionSection className="py-20">
          <div dir="rtl" className="text-center">
            <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">حلول تناسب احتياجك</p>
            <h2 className="mt-3 font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">مشروعك، أيًا كان مجاله</h2>
            <p className="mx-auto mt-4 max-w-2xl font-arabic text-sm leading-8 text-[var(--color-muted)]">
              نساعد الطلاب وأصحاب الأفكار والأعمال على تحويل احتياجهم إلى مشروع رقمي واضح وقابل للاستخدام.
            </p>
          </div>

          <MotionGrid className="mt-10 grid gap-5 md:grid-cols-3" >
            {audiences.map(({ icon: Icon, banner, title, description, points }) => (
              <article key={title} dir="rtl" className="group h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-colors hover:border-[var(--color-accent)]/60">
                <GeometricBanner variant={banner} className="-mx-6 -mt-6 mb-5 w-[calc(100%+3rem)]" />
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] transition-transform group-hover:scale-110">
                  <Icon size={22} />
                </div>
                <h3 className="font-arabic text-xl font-extrabold text-[var(--color-text)]">{title}</h3>
                <p className="mt-3 font-arabic text-sm leading-7 text-[var(--color-muted)]">{description}</p>
                <ul className="mt-5 grid gap-2">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2 font-arabic text-sm leading-7 text-[var(--color-muted)]">
                      <Check size={16} className="mt-1 shrink-0 text-[var(--color-accent-2)]" />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </MotionGrid>
        </MotionSection>

        <MotionSection id="process" className="scroll-mt-24 py-20">
          <div dir="rtl" className="text-center">
            <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">رحلة المشروع</p>
            <h2 className="mt-3 font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">ثلاث خطوات، بدون دوخة</h2>
            <p className="mx-auto mt-4 max-w-2xl font-arabic text-sm leading-8 text-[var(--color-muted)]">من أول رسالة حتى يصبح المشروع جاهزاً للاستخدام.</p>
          </div>

          <MotionGrid className="relative mt-12 grid gap-5 md:grid-cols-3">
            {workflow.map(({ icon: Icon, banner, title, description }, index) => (
              <article key={title} dir="rtl" className="relative h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
                <GeometricBanner variant={banner} label={`0${index + 1}`} className="-mx-6 -mt-6 mb-5 w-[calc(100%+3rem)]" />
                <div className="relative flex items-center justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]"><Icon size={22} /></div>
                  <span className="font-english text-sm font-bold text-[var(--color-accent-2)]">0{index + 1}</span>
                </div>
                <h3 className="relative mt-5 font-arabic text-xl font-extrabold text-[var(--color-text)]">{title}</h3>
                <p className="relative mt-3 font-arabic text-sm leading-7 text-[var(--color-muted)]">{description}</p>
              </article>
            ))}
          </MotionGrid>
        </MotionSection>

        <MotionSection className="py-20">
          <div dir="rtl" className="grid gap-10 rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 md:p-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">وش تستلم معنا؟</p>
              <h2 className="mt-3 text-balance font-arabic text-3xl font-extrabold leading-tight text-[var(--color-text)] md:text-4xl">مو مجرد ملفات تنرمي لك وتمشي</h2>
              <p className="mt-4 font-arabic text-sm leading-8 text-[var(--color-muted)]">نبني المشروع ونرتّب لك الصورة كاملة، عشان تعرف تستخدمه وتطوره بعد الإطلاق.</p>
            </div>
            <MotionGrid className="grid gap-3 sm:grid-cols-2">
              {deliverables.map(({ icon: Icon, banner, title, description }) => (
                <article key={title} className="h-full overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                  <GeometricBanner variant={banner} className="-mx-5 -mt-5 mb-4 w-[calc(100%+2.5rem)]" />
                  <Icon size={20} className="text-[var(--color-accent)]" />
                  <h3 className="mt-3 font-arabic text-base font-extrabold text-[var(--color-text)]">{title}</h3>
                  <p className="mt-2 font-arabic text-xs leading-6 text-[var(--color-muted)]">{description}</p>
                </article>
              ))}
            </MotionGrid>
          </div>
        </MotionSection>

        <MotionSection className="py-20">
          <div dir="rtl" className="overflow-hidden rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="grid gap-8 p-6 md:p-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
              <div>
                <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">كيف نحسب التكلفة؟</p>
                <h2 className="mt-3 text-balance font-arabic text-3xl font-extrabold leading-tight text-[var(--color-text)] md:text-4xl">تسعير على قد مشروعك، مو رقم عشوائي</h2>
                <p className="mt-4 font-arabic text-sm leading-8 text-[var(--color-muted)]">ما نحط سعرًا ثابتًا على أفكار مختلفة. نفهم المشروع أول، نحدد نطاقه، وبعدها نعطيك عرضًا واضحًا قبل ما نبدأ.</p>
                <Link href="/project-request" className="mt-6 inline-flex rounded-xl bg-[var(--color-accent)] px-5 py-3 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90">خذ تقدير لمشروعك</Link>
              </div>
              <MotionGrid className="grid gap-3 sm:grid-cols-2">
                {pricingFactors.map(({ icon: Icon, title, description }) => (
                  <article key={title} className="h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5">
                    <Icon size={20} className="text-[var(--color-accent)]" />
                    <h3 className="mt-3 font-arabic text-sm font-extrabold text-[var(--color-text)]">{title}</h3>
                    <p className="mt-2 font-arabic text-xs leading-6 text-[var(--color-muted)]">{description}</p>
                  </article>
                ))}
              </MotionGrid>
            </div>
          </div>
        </MotionSection>

        <MotionSection className="mx-[calc(50%-50vw)] w-screen py-20">
          <div dir="rtl" className="relative overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-16 text-center md:px-10">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent" aria-hidden="true" />
            <div className="relative mx-auto max-w-6xl">
              <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">جاهز تحوّل فكرتك إلى مشروع يعمل؟</h2>
              <p className="mx-auto mt-4 max-w-xl font-arabic text-sm leading-7 text-[var(--color-muted)]">أرسل فكرتك حتى لو كانت غير مرتبة، وسنساعدك على تحديد الخطوة المناسبة.</p>
              <div className="mt-7">
                <Link href="/project-request" className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-7 py-3.5 font-arabic text-sm font-extrabold text-black transition hover:-translate-y-0.5 hover:opacity-90">ابدأ مشروعك الآن</Link>
              </div>
            </div>
          </div>
        </MotionSection>
      </PublicFrame>
    </>
  );
}
