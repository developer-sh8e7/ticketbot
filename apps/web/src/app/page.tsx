'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  GraduationCap,
  LayoutTemplate,
  Award,
  Plus,
  Star,
  Clock,
} from 'lucide-react';
import { HomeHero } from '@/components/HomeHero';
import AnimatedCounter from '@/components/AnimatedCounter';
import { ServiceIllustration } from '@/components/ServiceIllustrations';
import { MotionGrid } from '@/components/MotionGrid';
import { MotionSection } from '@/components/MotionSection';
import { PublicFrame } from '@/components/ui';
import { PackagesSection, SELECT_CATEGORY_EVENT } from '@/components/PackagesSection';
import { SectionNav } from '@/components/SectionNav';

const audiences = [
  {
    icon: GraduationCap,
    title: 'للطلاب',
    description: 'نحول فكرتك الجامعية أو مشروع التخرج التقني إلى موقع أو تطبيق عملي وجاهز للعرض.',
    points: ['مواقع وتطبيقات لمشاريع التخرج', 'نماذج أولية قابلة للتجربة', 'واجهات ولوحات عرض مرتبة'],
  },
  {
    icon: LayoutTemplate,
    title: 'لأصحاب الأفكار',
    description: 'نحول فكرتك إلى موقع أو تطبيق أو أداة رقمية، سواء كانت بسيطة أو تحتاج مراحل متعددة.',
    points: ['مواقع تعريفية وخدمية', 'منصات خدمات وطلبات', 'لوحات تحكم وأدوات داخلية'],
  },
  {
    icon: BriefcaseBusiness,
    title: 'للأعمال',
    description: 'حلول رقمية تساعد نشاطك على تنظيم العمل وتقديم تجربة أفضل لعملائك.',
    points: ['أتمتة المهام المتكررة', 'إدارة العملاء والطلبات', 'تطوير وتوسع حسب الحاجة'],
  },
] as const;

const categoryCards = [
  { id: 'corporate', label: 'مواقع تعريفية', illustration: 'corporate', category: 'corporate' },
  { id: 'ecommerce', label: 'متاجر إلكترونية', illustration: 'ecommerce', category: 'ecommerce' },
  { id: 'landing', label: 'صفحات هبوط', illustration: 'landing', category: 'landing' },
  { id: 'uiux', label: 'واجهات وتجربة استخدام', illustration: 'uiux', category: 'all' },
  { id: 'graduation', label: 'مشاريع تخرج', illustration: 'graduation', category: 'graduation' },
  { id: 'mobile', label: 'تطبيقات جوال', illustration: 'mobile', category: 'mobile-app' },
] as const;

const stats = [
  { value: 29, suffix: '+', label: 'مشروع مكتمل', icon: Award },
  { value: 100, suffix: '%', label: 'رضاء العميل', icon: Star },
  { value: 39, suffix: 'H', label: 'أسرع تسليم', icon: Clock },
] as const;

const projects = [
  {
    title: 'متجر عطور وعود فاخر',
    category: 'متجر إلكتروني',
    description: 'متجر إلكتروني للعطور والعود الفاخر بهوية بصرية راقية ولوحة تحكم عربية لإدارة المنتجات والطلبات',
    image: '/projects/perfume-store.webp',
    tags: ['لوحة تحكم عربية', 'مدى وآبل باي', 'هوية فاخرة', 'ربط شركات الشحن'],
  },
  {
    title: 'موقع مطعم وطلبات أونلاين',
    category: 'صفحة هبوط',
    description: 'صفحة هبوط لمطعم مع قائمة طعام تفاعلية وطلب مباشر عبر واتساب وحجز طاولات',
    image: '/projects/restaurant.webp',
    tags: ['قائمة تفاعلية', 'طلب عبر واتساب', 'حجز طاولات', 'سريع التحميل'],
  },
  {
    title: 'منصة إدارة مشاريع التخرج',
    category: 'مشروع تخرج',
    description: 'نظام جامعي لمتابعة مشاريع التخرج مع لوحة إحصائيات وتوثيق كامل جاهز للمناقشة',
    image: '/projects/graduation.webp',
    tags: ['لوحة إحصائيات', 'نظام صلاحيات', 'توثيق كامل', 'عرض مناقشة'],
  },
  {
    title: 'تطبيق خدمات منزلية',
    category: 'تطبيق جوال',
    description: 'تطبيق حجز خدمات تنظيف وصيانة ونقل مع تتبع مباشر لوصول الفني',
    image: '/projects/services-app.webp',
    tags: ['حجز فوري', 'تتبع مباشر', 'دفع إلكتروني', 'iOS وAndroid'],
  },
  {
    title: 'موقع شركة استشارات هندسية',
    category: 'موقع تعريفي',
    description: 'موقع تعريفي لمكتب هندسي يعرض الخدمات والمشاريع مع نماذج طلب استشارة',
    image: '/projects/engineering.webp',
    tags: ['هوية بصرية', 'معرض مشاريع', 'نماذج تواصل', 'ثنائي اللغة'],
  },
] as const;

const faqs = [
  {
    question: 'كم مدة تسليم الموقع؟',
    answer: 'المدة تقديرية حسب حجم المشروع ومتطلباته والتعديلات المضافة أثناء العمل. نتفق معك على جدول زمني واضح قبل البدء، ونلتزم به.',
  },
  {
    question: 'هل يشمل السعر الاستضافة والدومين؟',
    answer: 'السعر يشمل التصميم والبرمجة والتسليم. الاستضافة والدومين يمكن إضافتهما كخدمة منفصلة أو نساعدك في ربط استضافتك الخاصة.',
  },
  {
    question: 'هل أقدر أعدل المحتوى بنفسي؟',
    answer: 'نعم، جميع مشاريعنا تتضمن لوحة تحكم عربية سهلة (CMS) تتيح لك تعديل النصوص، الصور، والمنتجات دون حاجة لمطور.',
  },
  {
    question: 'هل تقدر تنسخ موقع معين؟',
    answer: 'لا ننسخ تصاميم مملوكة لغيرك. نصمم لك هوية بصرية فريدة مستوحاة من مراجعك مع تحسين تجربة المستخدم والبرمجة النظيفة.',
  },
] as const;

const sectionNavItems = [
  { id: 'home', label: 'الرئيسية' },
  { id: 'services', label: 'ماذا تحتاج؟' },
  { id: 'packages', label: 'الباقات والأسعار' },
  { id: 'projects', label: 'أحدث أعمالنا' },
  { id: 'faq', label: 'أسئلة شائعة' },
  { id: 'contact', label: 'اطلب موقعك' },
];

function selectPackagesCategory(category: string) {
  window.dispatchEvent(new CustomEvent(SELECT_CATEGORY_EVENT, { detail: category }));
  document.getElementById('packages')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function HomePage() {
  return (
    <>
      <SectionNav items={sectionNavItems} />
      <PublicFrame>
        <div id="home" className="scroll-mt-24">
          <HomeHero />
        </div>

        {/* What do you need — service cards (filter the packages below) */}
        <MotionSection id="services" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-16">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-balance font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl lg:text-6xl"
              >
                ماذا تحتاج؟<br />
                <span className="text-[var(--color-accent)]">نبنيه لك</span>
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-auto mt-4 max-w-2xl font-arabic text-base leading-7 text-[var(--color-muted)] sm:mt-5 sm:text-lg sm:leading-8"
              >
                اختر نوع المشروع، وبتلقى الباقة والسعر مباشرة تحت.
              </motion.p>
            </div>

            <MotionGrid className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
              {categoryCards.map((cat, index) => (
                <motion.article
                  key={cat.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
                  dir="rtl"
                  className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_2px_12px_rgba(45,40,32,0.04)] transition-all duration-300 hover:border-[var(--color-accent)]/40 hover:shadow-[0_20px_50px_rgba(232,108,0,0.1)] focus-within:border-[var(--color-accent)]"
                >
                  <button
                    type="button"
                    onClick={() => selectPackagesCategory(cat.category)}
                    className="flex h-full min-h-44 w-full flex-col items-center justify-center px-2.5 py-5 text-center outline-none sm:min-h-56 sm:px-6 sm:pb-7 sm:pt-8"
                  >
                    <ServiceIllustration
                      variant={cat.illustration}
                      className="service-illustration h-24 w-auto max-w-full sm:h-32 md:h-36"
                    />
                    <h3 className="mt-3 font-arabic text-sm font-extrabold leading-6 text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)] sm:mt-6 sm:text-lg">
                      {cat.label}
                    </h3>
                  </button>
                </motion.article>
              ))}
            </MotionGrid>
          </div>
        </MotionSection>

        {/* Packages — full pricing on the same page */}
        <MotionSection id="packages" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-12">
              <h2 className="font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">
                الباقات <span className="text-[var(--color-accent)]">والأسعار</span>
              </h2>
              <p className="mx-auto mt-4 max-w-2xl font-arabic text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
                أسعار واضحة بدون رسوم مخفية. كل باقة تشمل التصميم والبرمجة والتسليم ودعم فني لمدة أسبوع.
              </p>
            </div>

            <PackagesSection />

            <p dir="rtl" className="mt-10 text-center font-arabic text-sm text-[var(--color-muted)]">
              تبي تفاصيل أكثر عن كل باقة؟{' '}
              <Link href="/packages" className="font-extrabold text-[var(--color-accent)] underline underline-offset-4 hover:text-[var(--color-accent-2)]">
                صفحة الباقات الكاملة
              </Link>
            </p>
          </div>
        </MotionSection>

        {/* Stats */}
        <MotionSection className="border-y border-[var(--color-border)] bg-[var(--color-surface)] py-10 md:py-24">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div className="grid grid-cols-3 gap-1 sm:gap-4 md:gap-8">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  className="p-2 text-center sm:p-6"
                >
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] sm:mb-4 sm:h-16 sm:w-16 sm:rounded-2xl">
                    <stat.icon size={24} className="sm:h-7 sm:w-7" />
                  </div>
                  <div className="font-english text-3xl font-extrabold text-[var(--color-text)] sm:text-4xl md:text-5xl lg:text-6xl">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <p className="mt-1.5 font-arabic text-xs leading-5 text-[var(--color-muted)] sm:mt-2 sm:text-base">{stat.label}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </MotionSection>

        {/* Audiences */}
        <MotionSection className="py-12 md:py-20">
          <div dir="rtl" className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12 text-center">
            <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">حلول تناسب احتياجك</p>
            <h2 className="mt-3 font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl">وش تبي نبني لك؟</h2>
            <p className="mx-auto mt-4 max-w-2xl font-arabic text-sm leading-8 text-[var(--color-muted)]">
              نصمم ونبرمج مواقع وتطبيقات وأنظمة رقمية للطلاب وأصحاب الأفكار والأعمال.
            </p>
          </div>

          <p dir="rtl" className="mt-6 px-4 text-center font-arabic text-xs text-[var(--color-muted)] md:hidden">اسحب عشان تشوف كل الخيارات</p>
          <MotionGrid
            className="opus-horizontal-track mx-auto mt-4 flex max-w-7xl snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mt-10 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-8 lg:px-12"
            itemClassName="min-w-[82vw] snap-center sm:min-w-[380px] md:min-w-0"
          >
            {audiences.map(({ icon: Icon, title, description, points }) => (
              <article key={title} dir="rtl" className="group h-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[0_2px_12px_rgba(45,40,32,0.04)] transition-all hover:border-[var(--color-accent)]/40 hover:shadow-[0_20px_50px_rgba(232,108,0,0.1)] sm:p-6">
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

        {/* Latest Projects */}
        <MotionSection id="projects" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-16">
              <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">أحدث أعمالنا</p>
              <h2 className="mt-3 font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">نماذج من مستوى شغلنا</h2>
              <p className="mx-auto mt-4 max-w-2xl font-arabic text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">أمثلة حقيقية لأنواع المشاريع اللي ننفذها، بنفس الجودة اللي بتستلمها.</p>
            </div>

            <p dir="rtl" className="mb-4 text-center font-arabic text-xs text-[var(--color-muted)] md:hidden">اسحب عشان تتصفح الأعمال</p>
            <MotionGrid
              className="opus-horizontal-track -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-3"
              itemClassName="min-w-[84vw] snap-center sm:min-w-[390px] md:min-w-0"
            >
              {projects.map((project, index) => (
                <motion.article
                  key={project.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.5, delay: index * 0.08 }}
                  dir="rtl"
                  className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:-translate-y-1 hover:border-[var(--color-accent)]/50 hover:shadow-[0_20px_50px_rgba(232,108,0,0.1)]"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={project.image}
                      alt={project.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute right-4 top-4 z-10">
                      <span className="rounded-full bg-[var(--color-accent)] px-3 py-1 font-arabic text-xs font-bold text-white shadow-[0_6px_18px_rgba(232,108,0,0.35)]">{project.category}</span>
                    </div>
                  </div>
                  <div className="p-5">
                    <h3 className="font-arabic text-lg font-extrabold text-[var(--color-text)] group-hover:text-[var(--color-accent)] transition-colors">{project.title}</h3>
                    <p className="mt-2 font-arabic text-sm leading-6 text-[var(--color-muted)] line-clamp-2">{project.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-2 py-1 font-arabic text-xs font-medium text-[var(--color-muted)]">{tag}</span>
                      ))}
                    </div>
                  </div>
                </motion.article>
              ))}
            </MotionGrid>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="mt-8 text-center md:mt-12"
            >
              <Link
                href="/project-request"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-accent)] px-8 py-3.5 font-arabic text-base font-extrabold text-white transition hover:opacity-90 hover:-translate-y-0.5"
              >
                ابدأ مشروعك القادم معنا
                <ArrowRight size={18} />
              </Link>
            </motion.div>
          </div>
        </MotionSection>

        {/* FAQ Section */}
        <MotionSection id="faq" className="scroll-mt-24 border-y border-[var(--color-border)] bg-[var(--color-surface)] py-12 md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-16">
              <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">أسئلة شائعة</p>
              <h2 className="mt-3 font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">عندك سؤال؟</h2>
              <p className="mx-auto mt-4 max-w-2xl font-arabic text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">هذي إجابات أوضح الأسئلة اللي توصلنا. وإذا ما لقيت سؤالك تواصل معنا مباشرة.</p>
            </div>

            <div className="space-y-4">
              {faqs.map((faq, index) => (
                <motion.details
                  key={faq.question}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  dir="rtl"
                  className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] overflow-hidden transition-all hover:border-[var(--color-accent)]/50"
                >
                  <summary className="flex min-h-16 cursor-pointer list-none items-center justify-between gap-4 p-4 font-arabic text-sm font-bold text-[var(--color-text)] sm:p-5 sm:text-base">
                    {faq.question}
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] transition-all group-open:rotate-45">
                      <Plus size={18} />
                    </div>
                  </summary>
                  <div className="px-4 pb-4 font-arabic text-sm leading-7 text-[var(--color-muted)] sm:px-5 sm:pb-5">
                    {faq.answer}
                  </div>
                </motion.details>
              ))}
            </div>
          </div>
        </MotionSection>

        {/* CTA Section */}
        <MotionSection id="contact" className="scroll-mt-24 mx-[calc(50%-50vw)] w-screen py-12 md:py-20">
          <div dir="rtl" className="relative overflow-hidden border-y border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-14 text-center sm:px-6 md:px-10 md:py-16">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-accent)] to-transparent" aria-hidden="true" />
            <div className="relative mx-auto max-w-6xl">
              <h2 className="font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl">جاهز تحول فكرتك إلى موقع أو تطبيق يعمل؟</h2>
              <p className="mx-auto mt-4 max-w-xl font-arabic text-sm leading-7 text-[var(--color-muted)]">أرسل فكرتك حتى لو كانت غير مرتبة، وسنساعدك على تحديد الخطوة المناسبة.</p>
              <div className="mt-7">
                <Link href="/project-request" className="inline-flex items-center justify-center rounded-xl bg-[var(--color-accent)] px-7 py-3.5 font-arabic text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:opacity-90">اطلب موقعك أو تطبيقك</Link>
              </div>
            </div>
          </div>
        </MotionSection>
      </PublicFrame>
    </>
  );
}
