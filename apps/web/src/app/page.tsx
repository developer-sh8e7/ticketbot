'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
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
import { AudienceCard, SolutionCard } from '@/components/FlowCard';
import { PackagesSection, SELECT_CATEGORY_EVENT } from '@/components/PackagesSection';
import { ScrollProgress } from '@/components/ScrollProgress';
import { BgVideo } from '@/components/fx/BgVideo';
import { SmoothScroll, scrollToSection } from '@/components/fx/SmoothScroll';
import { Preloader } from '@/components/fx/Preloader';
import { CustomCursor } from '@/components/fx/CustomCursor';
import { RevealText } from '@/components/fx/RevealText';

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
  { id: 'corporate', label: 'مواقع تعريفية', description: 'موقع تعريفي احترافي للشركات والمؤسسات — يعرض خدماتك، فريقك، أعمالك بتجربة مميزة', illustration: 'corporate', category: 'corporate', image: '/cards/cardopus8.jpg', tone: 'dark' },
  { id: 'ecommerce', label: 'متاجر إلكترونية', description: 'متجر إلكتروني كامل بجميع الميزات للبيع أونلاين — منتجات، دفع، شحن، لوحة تحكم', illustration: 'ecommerce', category: 'ecommerce', image: '/cards/cardopus3.jpg', tone: 'light' },
  { id: 'landing', label: 'صفحات هبوط', description: 'صفحة هبوط (Landing Page) عالية التحويل للمطاعم، العروض، الحملات، إطلاق المنتجات', illustration: 'landing', category: 'landing', image: '/cards/cardopus1.jpg', tone: 'light' },
  { id: 'uiux', label: 'واجهات وتجربة استخدام', description: 'دراسة جدوى تقنية وتصميم تجربة مستخدم (UX/UI)', illustration: 'uiux', category: 'all', image: '/cards/cardopus5.jpg', tone: 'dark' },
  { id: 'graduation', label: 'مشاريع تخرج', description: 'موقع أو تطبيق لمشروع التخرج الجامعي — فكرة، تصميم، برمجة، توثيق، عرض تقديمي', illustration: 'graduation', category: 'graduation', image: '/cards/cardopus4.jpg', tone: 'light' },
  { id: 'mobile', label: 'تطبيقات جوال', description: 'تطبيق جوال أصلي (iOS/Android) أو كروس بلاتفورم — من الفكرة للنشر على المتاجر', illustration: 'mobile', category: 'mobile-app', image: '/cards/cardopus7.jpg', tone: 'dark' },
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

function selectPackagesCategory(category: string) {
  window.dispatchEvent(new CustomEvent(SELECT_CATEGORY_EVENT, { detail: category }));
  scrollToSection('packages');
}

export default function HomePage() {
  return (
    <>
      <Preloader />
      <SmoothScroll />
      <CustomCursor />
      <ScrollProgress />
      <PublicFrame>
        <div id="home" className="scroll-mt-24">
          <HomeHero />
        </div>

        {/* What do you need — service cards (filter the packages below) */}
        <MotionSection id="services" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-16">
              <h2 className="text-balance font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl lg:text-6xl">
                <RevealText text="ماذا تحتاج؟" /><br />
                <span className="text-[var(--color-accent)]"><RevealText text="نبنيه لك" delay={0.12} /></span>
              </h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mx-auto mt-4 max-w-2xl font-arabic text-base leading-7 text-[var(--color-muted)] sm:mt-5 sm:text-lg sm:leading-8"
              >
                اختر نوع المشروع، وبتلقى الباقة والسعر مباشرة تحت.
              </motion.p>
            </div>

            <MotionGrid className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {categoryCards.map((cat, index) => (
                <SolutionCard
                  key={cat.id}
                  label={cat.label}
                  description={cat.description}
                  index={index}
                  variant={(['glass', 'tint', 'solid'] as const)[index % 3]}
                  image={cat.image}
                  tone={cat.tone}
                  onExplore={() => selectPackagesCategory(cat.category)}
                  visual={(
                    <ServiceIllustration
                      variant={cat.illustration}
                      className="service-illustration h-28 w-auto max-w-full sm:h-32 md:h-36"
                    />
                  )}
                />
              ))}
            </MotionGrid>
          </div>
        </MotionSection>

        {/* Packages — one contained video-backed pricing panel */}
        <MotionSection id="packages" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-[88rem] px-3 sm:px-4 md:px-8">
            <div dir="rtl" className="pricing-panel">
              <span className="pricing-panel-fallback" aria-hidden="true" />
              <BgVideo src="/cards/card-3.mp4" poster="/cards/card-3-poster.jpg" />
              <span className="pricing-panel-veil" aria-hidden="true" />

              <div className="pricing-panel-content">
                <div className="mb-8 text-center md:mb-12">
                  <h2 className="font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">
                    <RevealText text="الباقات والأسعار" accentWords={['والأسعار']} />
                  </h2>
                  <p className="mx-auto mt-4 max-w-2xl font-arabic text-base leading-7 text-[var(--color-muted)] sm:text-lg sm:leading-8">
                    أسعار واضحة بدون رسوم مخفية. كل باقة تشمل التصميم والبرمجة والتسليم ودعم فني لمدة أسبوع.
                  </p>
                </div>

                <PackagesSection />

                <p className="mt-8 text-center font-arabic text-sm text-[var(--color-muted)] md:mt-10">
                  تبي تفاصيل أكثر عن كل باقة؟{' '}
                  <Link href="/packages" className="font-extrabold text-[var(--color-accent-2)] underline underline-offset-4 hover:text-[var(--color-text)]">
                    صفحة الباقات الكاملة
                  </Link>
                </p>
              </div>
            </div>
          </div>
        </MotionSection>

        {/* Stats */}
        <MotionSection className="py-10 md:py-16">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div className="media-panel">
              <BgVideo src="/cards/card-3.mp4" poster="/cards/card-3-poster.jpg" />
              <span className="media-panel-veil" aria-hidden="true" />
              <div className="relative z-10 grid grid-cols-3 px-1 py-8 sm:px-6 md:py-14">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ duration: 0.6, delay: index * 0.12 }}
                  className={`stat-cell p-2 text-center sm:p-6 ${index > 0 ? 'stat-cell-divided' : ''}`}
                >
                  <div className="stat-number font-english text-4xl font-extrabold sm:text-5xl md:text-6xl lg:text-7xl">
                    <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                  </div>
                  <motion.span
                    initial={{ scaleX: 0 }}
                    whileInView={{ scaleX: 1 }}
                    viewport={{ once: true, margin: '-50px' }}
                    transition={{ duration: 0.7, delay: 0.35 + index * 0.12, ease: [0.22, 1, 0.36, 1] }}
                    className="stat-underline"
                    aria-hidden="true"
                  />
                  <p className="mt-2.5 flex items-center justify-center gap-1.5 font-arabic text-xs leading-5 text-[var(--color-muted)] sm:mt-3 sm:gap-2 sm:text-base">
                    <span className="stat-icon">
                      <stat.icon size={14} className="sm:h-4 sm:w-4" />
                    </span>
                    {stat.label}
                  </p>
                </motion.div>
              ))}
              </div>
            </div>
          </div>
        </MotionSection>

        {/* Audiences */}
        <MotionSection className="py-12 md:py-20">
          <div dir="rtl" className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12 text-center">
            <p className="section-eyebrow font-arabic">حلول تناسب احتياجك</p>
            <h2 className="mt-4 text-balance font-arabic text-3xl font-extrabold leading-snug tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">
              <RevealText text="وش تبي نبني لك؟" accentWords={['نبني']} />
            </h2>
            <p className="mx-auto mt-4 max-w-2xl font-arabic text-sm leading-8 text-[var(--color-muted)] sm:text-base">
              نصمم ونبرمج مواقع وتطبيقات وأنظمة رقمية للطلاب وأصحاب الأفكار والأعمال.
            </p>
          </div>

          <div className="mx-auto mt-8 grid max-w-7xl items-start gap-4 px-4 md:mt-12 md:grid-cols-3 md:gap-5 md:px-8 lg:px-12">
            {audiences.map(({ icon, title, description, points }, index) => (
              <AudienceCard
                key={title}
                icon={icon}
                title={title}
                description={description}
                points={points}
                variant={(['solid', 'glass', 'tint'] as const)[index % 3]}
                index={index}
              />
            ))}
          </div>
        </MotionSection>

        {/* Latest Projects */}
        <MotionSection id="projects" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-16">
              <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">أحدث أعمالنا</p>
              <h2 className="mt-3 font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">
                <RevealText text="نماذج من مستوى شغلنا" accentWords={['شغلنا']} />
              </h2>
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
                  className="group overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all hover:-translate-y-1 hover:border-[var(--color-accent)]/50 hover:shadow-[0_20px_50px_rgba(15,201,143,0.14)]"
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={project.image}
                      alt={project.title}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute right-4 top-4 z-10">
                      <span className="rounded-full bg-[var(--color-accent)] px-3 py-1 font-arabic text-xs font-bold text-white shadow-[0_6px_18px_rgba(15,201,143,0.3)]">{project.category}</span>
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
        <MotionSection id="faq" className="scroll-mt-24 border-y border-[var(--color-border)]/70 bg-[var(--color-surface)]/[0.58] py-12 backdrop-blur-xl md:py-20">
          <div className="mx-auto max-w-3xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="mb-8 text-center md:mb-16">
              <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">أسئلة شائعة</p>
              <h2 className="mt-3 font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">
                <RevealText text="عندك سؤال؟" />
              </h2>
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
        <MotionSection id="contact" className="scroll-mt-24 py-12 md:py-20">
          <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
            <div dir="rtl" className="media-panel px-5 py-14 text-center sm:px-6 md:px-10 md:py-20">
              <BgVideo src="/cards/card-2.mp4" poster="/cards/card-2-poster.jpg" />
              <span className="media-panel-veil" aria-hidden="true" />
              <div className="relative z-10 mx-auto max-w-3xl">
                <h2 className="text-balance font-arabic text-3xl font-extrabold leading-snug tracking-tight text-[var(--color-text)] sm:text-4xl md:text-5xl">
                  <RevealText text="جاهز تحول فكرتك إلى موقع أو تطبيق يعمل؟" accentWords={['فكرتك']} />
                </h2>
                <p className="mx-auto mt-5 max-w-xl font-arabic text-sm leading-8 text-[var(--color-muted)] sm:text-base">أرسل فكرتك حتى لو كانت غير مرتبة، وسنساعدك على تحديد الخطوة المناسبة.</p>
                <div className="mt-8">
                  <Link href="/project-request" className="cta-button font-arabic">
                    اطلب موقعك أو تطبيقك
                    <ArrowLeft size={16} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </MotionSection>
      </PublicFrame>
    </>
  );
}
