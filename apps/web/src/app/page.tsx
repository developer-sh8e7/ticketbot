import Link from 'next/link';
import { BriefcaseBusiness, Check, ClipboardCheck, GraduationCap, Headphones, LayoutTemplate } from 'lucide-react';
import { HomeHero } from '@/components/HomeHero';
import { MotionSection } from '@/components/MotionSection';
import { PublicFrame } from '@/components/ui';
import { WelcomeIntro } from '@/components/WelcomeIntro';

const audiences = [
  {
    icon: GraduationCap,
    title: 'للطلاب',
    description: 'نحوّل فكرة مشروعك الجامعي أو مشروع التخرج إلى نموذج عملي واضح وجاهز للعرض.',
    points: ['مواقع ومشاريع تخرج', 'نماذج أولية قابلة للتجربة', 'واجهات ولوحات عرض مرتبة'],
  },
  {
    icon: LayoutTemplate,
    title: 'للمشاريع العامة',
    description: 'موقع أو نظام أو أداة رقمية تُبنى حول فكرتك، سواء كانت بسيطة أو تحتاج مراحل متعددة.',
    points: ['مواقع تعريفية وخدمية', 'أنظمة حجوزات وطلبات', 'لوحات تحكم وأدوات داخلية'],
  },
  {
    icon: BriefcaseBusiness,
    title: 'للأعمال',
    description: 'حلول رقمية تساعد نشاطك على تنظيم العمل وتقديم تجربة أفضل لعملائك.',
    points: ['أتمتة المهام المتكررة', 'إدارة العملاء والطلبات', 'تطوير وتوسّع حسب الحاجة'],
  },
] as const;

const workflow = [
  {
    icon: ClipboardCheck,
    title: 'نرتّب الفكرة معك',
    description: 'نراجع الهدف والمتطلبات ونحوّلها إلى نطاق عمل واضح قبل البدء.',
  },
  {
    icon: LayoutTemplate,
    title: 'نصمم ونطوّر',
    description: 'نبني تجربة مرتبة وسهلة الاستخدام تناسب طبيعة مشروعك وجمهوره.',
  },
  {
    icon: Headphones,
    title: 'نسلّم وندعم',
    description: 'تستلم مشروعاً جاهزاً مع توضيح طريقة استخدامه ودعم حسب الاتفاق.',
  },
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
          <h2 className="mt-3 font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">
            مشروعك، أيًا كان مجاله
          </h2>
          <p className="mx-auto mt-4 max-w-2xl font-arabic text-sm leading-8 text-[var(--color-muted)]">
            نساعد الطلاب وأصحاب الأفكار والأعمال على تحويل احتياجهم إلى مشروع رقمي واضح وقابل للاستخدام.
          </p>
        </div>

        <div dir="rtl" className="mt-10 grid gap-5 md:grid-cols-3">
          {audiences.map(({ icon: Icon, title, description, points }) => (
            <article key={title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
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
        </div>
      </MotionSection>

      <MotionSection className="py-20">
        <div dir="rtl" className="text-center">
          <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">كيف نبدأ مشروعك؟</h2>
          <p className="mx-auto mt-4 max-w-2xl font-arabic text-sm leading-8 text-[var(--color-muted)]">
            خطوات بسيطة وواضحة من أول رسالة حتى التسليم.
          </p>
        </div>

        <div dir="rtl" className="mt-10 grid gap-5 md:grid-cols-3">
          {workflow.map(({ icon: Icon, title, description }, index) => (
            <article key={title} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
                  <Icon size={22} />
                </div>
                <span className="font-english text-sm font-bold text-[var(--color-muted)]">0{index + 1}</span>
              </div>
              <h3 className="mt-5 font-arabic text-xl font-extrabold text-[var(--color-text)]">{title}</h3>
              <p className="mt-3 font-arabic text-sm leading-7 text-[var(--color-muted)]">{description}</p>
            </article>
          ))}
        </div>
      </MotionSection>

      <MotionSection className="mx-[calc(50%-50vw)] w-screen py-20">
        <div dir="rtl" className="border-y border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center md:px-10">
          <div className="mx-auto max-w-6xl">
            <h2 className="font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)]">
              جاهز تحوّل فكرتك إلى مشروع يعمل؟
            </h2>
            <p className="mx-auto mt-4 max-w-xl font-arabic text-sm leading-7 text-[var(--color-muted)]">
              أرسل فكرتك حتى لو كانت غير مرتبة، وسنساعدك على تحديد الخطوة المناسبة.
            </p>
            <div className="mt-7">
              <Link href="/project-request" className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-6 py-3 font-arabic text-sm font-extrabold text-black transition hover:opacity-90">
                اطلب مشروعك
              </Link>
            </div>
          </div>
        </div>
        </MotionSection>
      </PublicFrame>
    </>
  );
}
