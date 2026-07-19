'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  ShoppingCart,
  LayoutDashboard,
  GraduationCap,
  LayoutTemplate,
  Smartphone,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import {
  PackageOrbitScene,
  type PackageOrbitInteraction,
  type PackageOrbitItem,
} from '@/components/PackageOrbitScene';
import { PriceWithRiyal } from '@/components/RiyalIcon';

export const packages = [
  {
    id: 'ecommerce',
    name: 'متجر إلكتروني',
    shortName: 'متجر إلكتروني',
    icon: ShoppingCart,
    description: 'متجر إلكتروني كامل بجميع الميزات للبيع أونلاين — منتجات، دفع، شحن، لوحة تحكم',
    price: 3500,
    originalPrice: 4500,
    discount: 22,
    deliveryTime: 'تقديري حسب حجم المشروع ومتطلباته',
    quality: 'احترافية 100%',
    support: 'دعم فني لمدة أسبوع',
    features: [
      'تصميم مخصص للواجهة والمتجر',
      'لوحة تحكم عربية سهلة للإدارة',
      'إدارة منتجات وفئات غير محدودة',
      'نظام دفع سعودي (مدى، آبل باي، STC Pay)',
      'ربط شركات الشحن (أرامكس، سمسا، زاجل)',
      'نظام كوبونات وخصومات وعروض',
      'تقارير مبيعات ومخزون مفصلة',
      'متعدد العملات واللغات (عربي/إنجليزي)',
      'تحسين محركات البحث (SEO) كامل',
      'استضافة سريعة وآمنة مع SSL',
      'تدريب على استخدام لوحة التحكم',
      'نسخ احتياطية يومية تلقائية',
    ],
    popular: true,
    category: 'متاجر إلكترونية',
  },
  {
    id: 'corporate',
    name: 'موقع تعريفي',
    shortName: 'موقع تعريفي',
    icon: LayoutDashboard,
    description: 'موقع تعريفي احترافي للشركات والمؤسسات — يعرض خدماتك، فريقك، أعمالك بتجربة مميزة',
    price: 1000,
    originalPrice: 1800,
    discount: 44,
    deliveryTime: 'تقديري حسب حجم المشروع ومتطلباته',
    quality: 'احترافية 100%',
    support: 'دعم فني لمدة أسبوع',
    features: [
      'تصميم مخصص يعكس هوية العلامة التجارية',
      'صفحات: الرئيسية، من نحن، الخدمات، المعرض، اتصل بنا',
      'مدونة/أخبار مع نظام إدارة محتوى سهل',
      'نماذج تواصل وعروض أسعار ذكية',
      'تكامل خرائط جوجل وواتساب',
      'معرض أعمال/مشاريع تفاعلي',
      'فريق العمل مع ملفات شخصية',
      'متجاوب 100% على جميع الأجهزة',
      'تحسين سرعة وأداء (Core Web Vitals)',
      'SEO تقني وأساسي جاهز',
      'نموذج توظيف/انضم إلينا (اختياري)',
      'تدريب على إدارة المحتوى',
    ],
    popular: false,
    category: 'مواقع تعريفية',
  },
  {
    id: 'graduation',
    name: 'مشاريع تخرج',
    shortName: 'مشاريع تخرج',
    icon: GraduationCap,
    description: 'موقع أو تطبيق لمشروع التخرج الجامعي — فكرة، تصميم، برمجة، توثيق، عرض تقديمي',
    price: 1500,
    originalPrice: 2500,
    discount: 40,
    deliveryTime: 'تقديري حسب حجم المشروع ومتطلباته',
    quality: 'احترافية 100% — جاهز للمناقشة',
    support: 'دعم فني لمدة أسبوع',
    features: [
      'فهم الفكرة وتحويلها لمتطلبات تقنية واضحة',
      'قاعدة بيانات وتصميم نظام (ERD، UML)',
      'واجهة مستخدم عصرية وتجربة سلسة',
      'لوحة تحكم للمشرف/الطالب',
      'نظام مستخدمين وصلاحيات',
      'تقارير وإحصائيات مرئية (Charts)',
      'توثيق تقني كامل (SRS، SDD، كود موثق)',
      'عرض تقديمي (Slides) جاهز للمناقشة',
      'فيديو توضيحي للمشروع (دقيقة واحدة)',
      'كود نظيف ومرتب على GitHub',
      'نشر على استضافة مجانية/مدفوعة',
      'دعم أثناء المناقشة وبعدها',
    ],
    popular: true,
    category: 'مشاريع تخرج',
  },
  {
    id: 'landing',
    name: 'صفحة هبوط تسويقية',
    shortName: 'صفحة هبوط',
    icon: LayoutTemplate,
    description: 'صفحة هبوط (Landing Page) عالية التحويل للمطاعم، العروض، الحملات، إطلاق المنتجات',
    price: 500,
    originalPrice: 1200,
    discount: 58,
    deliveryTime: 'تقديري حسب حجم المشروع ومتطلباته',
    quality: 'احترافية 100% — سريعة التحميل',
    support: 'دعم فني لمدة أسبوع',
    features: [
      'تصميم مقنع يركز على التحويل (Conversion)',
      'Hero Section جذاب مع CTA واضح',
      'عرض المزايا/الخدمات بأيقونات ورسوم',
      'قسم تقييمات العملاء (Testimonials)',
      'معرض صور/فيديوهات تفاعلي',
      'نموذج حجز/طلب/اشتراك محسن',
      'تكامل واتساب، خرائط، تقويم',
      'عدادات إحصائية متحركة',
      'FAQ قابل للطي',
      'متجاوبة وسريعة (<3ث تحميل)',
      'SEO جاهز للحملات الإعلانية',
      'كود نظيف قابل للتوسع لاحقا',
    ],
    popular: false,
    category: 'صفحات هبوط',
  },
  {
    id: 'mobile-app',
    name: 'تطبيق جوال',
    shortName: 'تطبيق جوال',
    icon: Smartphone,
    description: 'تطبيق جوال أصلي (iOS/Android) أو كروس بلاتفورم — من الفكرة للنشر على المتاجر',
    price: 8000,
    originalPrice: 12000,
    discount: 33,
    deliveryTime: 'تقديري حسب حجم المشروع ومتطلباته',
    quality: 'احترافية 100% — جاهز للنشر',
    support: 'دعم فني لمدة أسبوع',
    features: [
      'دراسة جدوى تقنية وتصميم تجربة مستخدم (UX/UI)',
      'تصميم شاشات كاملة بنظام تصميم موحد',
      'تطوير React Native / Flutter (كروس بلاتفورم)',
      'Backend API مخصص (Node.js/ Laravel/ Python)',
      'قاعدة بيانات سحابية آمنة',
      'مصادقة (هاتف، إيميل، اجتماعي، Biometric)',
      'إشعارات دفع (Push Notifications)',
      'مدفوعات داخل التطبيق (Apple/Google Pay)',
      'وضع عدم الاتصال (Offline Mode)',
      'تحليلات استخدام (Firebase/Amplitude)',
      'نشر على App Store و Google Play',
      'توثيق API وكود منظم',
    ],
    popular: false,
    category: 'تطبيقات جوال',
  },
];

export const packageCategories = [
  { id: 'all', label: 'الكل', icon: Layers },
  { id: 'ecommerce', label: 'متاجر إلكترونية', icon: ShoppingCart },
  { id: 'corporate', label: 'مواقع تعريفية', icon: LayoutDashboard },
  { id: 'graduation', label: 'مشاريع تخرج', icon: GraduationCap },
  { id: 'landing', label: 'صفحات هبوط', icon: LayoutTemplate },
  { id: 'mobile-app', label: 'تطبيقات جوال', icon: Smartphone },
];

const validCategories = new Set(packageCategories.map((c) => c.id));

/** Event other components can dispatch to filter this section: `new CustomEvent('opus-select-category', { detail: 'ecommerce' })` */
export const SELECT_CATEGORY_EVENT = 'opus-select-category';

export function PackagesSection({ initialCategory = 'all' }: { initialCategory?: string }) {
  const [selectedCategory, setSelectedCategory] = useState(
    validCategories.has(initialCategory) ? initialCategory : 'all'
  );
  const [selectedPackage, setSelectedPackage] = useState<{
    package: typeof packages[0];
    interaction: PackageOrbitInteraction;
  } | null>(null);

  useEffect(() => {
    const nextCategory = validCategories.has(initialCategory) ? initialCategory : 'all';
    setSelectedCategory(nextCategory);
  }, [initialCategory]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const category = (event as CustomEvent<string>).detail;
      if (validCategories.has(category)) {
        setSelectedCategory(category);
      }
    };
    window.addEventListener(SELECT_CATEGORY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_CATEGORY_EVENT, onSelect);
  }, []);

  const focusId = selectedCategory === 'all' ? null : selectedCategory;
  const displayedPackage = selectedPackage;

  const toggleSelectedDetails = (pkg: PackageOrbitItem | null, interaction: PackageOrbitInteraction) => {
    if (!pkg) {
      setSelectedPackage(null);
      return;
    }
    const fullPackage = packages.find((candidate) => candidate.id === pkg.id);
    if (fullPackage) setSelectedPackage({ package: fullPackage, interaction });
  };

  return (
    <div dir="rtl" className="relative">
      {/* Category Tabs */}
      <div
        className="opus-horizontal-track relative z-10 -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:items-center sm:justify-center sm:overflow-visible sm:px-0"
        role="tablist"
        aria-label="تصنيف الباقات"
      >
        {packageCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => {
              setSelectedCategory(cat.id);
            }}
            role="tab"
            aria-selected={selectedCategory === cat.id}
            className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-full px-4 py-2.5 font-arabic text-sm font-bold backdrop-blur-xl transition-all duration-300 ${
              selectedCategory === cat.id
                ? 'border border-white/70 bg-[var(--color-accent)] text-[var(--color-on-accent)] shadow-[0_12px_34px_rgba(15,201,143,0.24)]'
                : 'border border-white/70 bg-[var(--color-surface)]/75 text-[var(--color-muted)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text)]'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      <div className="package-orbit-shell relative mx-[calc(50%-50vw)] mt-4 w-screen overflow-hidden sm:mt-6">
        <PackageOrbitScene
          items={packages}
          focusId={focusId}
          selectedId={selectedPackage?.package.id ?? null}
          onActivate={toggleSelectedDetails}
        />
        <div className="package-orbit-edge package-orbit-edge-start" aria-hidden="true" />
        <div className="package-orbit-edge package-orbit-edge-end" aria-hidden="true" />

        <AnimatePresence mode="wait">
          {displayedPackage ? (
            <motion.aside
              key={displayedPackage.package.id}
              initial={{ opacity: 0, scaleX: 0.05, scaleY: 0.08, x: 26, filter: 'blur(18px)' }}
              animate={{ opacity: 1, scaleX: 1, scaleY: 1, x: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, scaleX: 0.08, scaleY: 0.12, x: 18, filter: 'blur(12px)' }}
              transition={{ duration: 0.72, delay: 0.72, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: '100% 14%' }}
              className="package-orbit-detail is-left"
              aria-live="polite"
            >
              <div className="package-orbit-detail-glow" aria-hidden="true" />
              <div className="package-orbit-detail-scan" aria-hidden="true" />
              <i className="package-orbit-corner package-orbit-corner-tl" aria-hidden="true" />
              <i className="package-orbit-corner package-orbit-corner-br" aria-hidden="true" />
              <div className="relative z-10">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.48, delay: 1.02, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-3 flex items-center justify-between font-english text-[10px] font-bold tracking-[0.18em] text-[var(--color-accent-2)]"
                >
                  <span>OPUS / PACKAGE SIGNAL</span>
                  <span className="package-orbit-live-dot">LIVE</span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.54, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="inline-flex items-center gap-2 font-arabic text-xs font-extrabold text-[var(--color-accent-2)]">
                      <Sparkles size={14} />
                      {displayedPackage.package.category}
                    </div>
                    <h3 className="mt-2 font-arabic text-2xl font-extrabold leading-tight text-[var(--color-text)] sm:text-3xl">
                      {displayedPackage.package.name}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPackage(null)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/80 bg-white/60 text-[var(--color-text)] transition hover:rotate-90 hover:bg-white focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                    aria-label="إغلاق تفاصيل الباقة"
                  >
                    <X size={17} />
                  </button>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, scaleX: 0.2 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.62, delay: 1.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'right' }}
                  className="mt-4 flex items-end justify-between gap-4 border-y border-[var(--color-text)]/10 py-3"
                >
                  <PriceWithRiyal amount={displayedPackage.package.price} size="lg" />
                  {displayedPackage.package.discount > 0 ? (
                    <span className="rounded-full bg-[var(--aurora-lime)] px-3 py-1 font-arabic text-xs font-extrabold text-[var(--color-on-accent)]">
                      وفر {displayedPackage.package.discount}%
                    </span>
                  ) : null}
                </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.48, delay: 1.34, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-3 line-clamp-2 font-arabic text-sm leading-7 text-[var(--color-muted)]"
                >
                  {displayedPackage.package.description}
                </motion.p>

                <motion.ul
                  initial="hidden"
                  animate="visible"
                  variants={{
                    hidden: {},
                    visible: { transition: { delayChildren: 1.42, staggerChildren: 0.08 } },
                  }}
                  className="mt-3 grid gap-1.5"
                >
                  {displayedPackage.package.features.slice(0, 3).map((feature) => (
                    <motion.li
                      key={feature}
                      variants={{ hidden: { opacity: 0, x: 16 }, visible: { opacity: 1, x: 0 } }}
                      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="flex items-start gap-2 font-arabic text-xs leading-6 text-[var(--color-text)]"
                    >
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent)] text-[var(--color-on-accent)]">
                        <Check size={10} strokeWidth={3} />
                      </span>
                      <span className="line-clamp-1">{feature}</span>
                    </motion.li>
                  ))}
                </motion.ul>

                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.52, delay: 1.7, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Link
                    href="/project-request"
                    className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-text)] px-5 py-2.5 font-arabic text-sm font-extrabold text-white transition hover:-translate-y-0.5 hover:bg-[var(--color-accent-2)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
                  >
                    ابدأ مشروعك
                    <ArrowLeft size={16} />
                  </Link>
                </motion.div>
              </div>
            </motion.aside>
          ) : null}
        </AnimatePresence>
      </div>

      <div className="mt-4 flex flex-col items-center justify-center gap-1 text-center font-arabic text-xs text-[var(--color-muted)] sm:flex-row sm:gap-3">
        <span>المسار يتحرك بشكل مستمر</span>
        <span className="hidden h-1 w-1 rounded-full bg-[var(--color-accent)] sm:block" />
        <span>اضغط على البطاقة لاطلاق التفاصيل</span>
        <Link href="/project-request" className="mt-2 font-extrabold text-[var(--color-accent-2)] underline underline-offset-4 sm:mt-0">أو اطلب عرض مخصص</Link>
      </div>

      <ul className="sr-only" aria-label="قائمة الباقات النصية">
        {packages.map((pkg) => (
          <li key={pkg.id}>
            <strong>{pkg.name}</strong>: {pkg.description} — {pkg.price.toLocaleString('ar-SA')} ريال
          </li>
        ))}
      </ul>

    </div>
  );
}
