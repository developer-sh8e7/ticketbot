'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  LayoutDashboard,
  GraduationCap,
  LayoutTemplate,
  Smartphone,
  Layers,
  MousePointerClick,
  Sparkles,
} from 'lucide-react';
import { PackageDetailsModal } from '@/components/PackageDetailsModal';
import { PackageOrbitScene, type PackageOrbitItem } from '@/components/PackageOrbitScene';
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
  const [previewId, setPreviewId] = useState(
    validCategories.has(initialCategory) && initialCategory !== 'all' ? initialCategory : packages[0].id
  );
  const [openPackage, setOpenPackage] = useState<{
    package: typeof packages[0];
    origin: { x: number; y: number };
  } | null>(null);

  useEffect(() => {
    const nextCategory = validCategories.has(initialCategory) ? initialCategory : 'all';
    setSelectedCategory(nextCategory);
    if (nextCategory !== 'all') setPreviewId(nextCategory);
  }, [initialCategory]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const category = (event as CustomEvent<string>).detail;
      if (validCategories.has(category)) {
        setSelectedCategory(category);
        if (category !== 'all') setPreviewId(category);
      }
    };
    window.addEventListener(SELECT_CATEGORY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_CATEGORY_EVENT, onSelect);
  }, []);

  const previewPackage = packages.find((pkg) => pkg.id === previewId) ?? packages[0];
  const focusId = selectedCategory === 'all' ? null : selectedCategory;

  const openDetails = (pkg: typeof packages[0] | PackageOrbitItem, origin: { x: number; y: number }) => {
    const fullPackage = packages.find((candidate) => candidate.id === pkg.id);
    if (fullPackage) setOpenPackage({ package: fullPackage, origin });
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
              if (cat.id !== 'all') setPreviewId(cat.id);
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
        <div className="package-orbit-aura" aria-hidden="true" />
        <PackageOrbitScene
          items={packages}
          focusId={focusId}
          onHoverChange={(item) => {
            if (item) setPreviewId(item.id);
          }}
          onActivate={openDetails}
        />
        <div className="package-orbit-edge package-orbit-edge-start" aria-hidden="true" />
        <div className="package-orbit-edge package-orbit-edge-end" aria-hidden="true" />
      </div>

      <motion.div
        key={previewPackage.id}
        initial={{ opacity: 0, y: 12, filter: 'blur(8px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
        className="package-orbit-summary relative z-10 mx-auto -mt-8 max-w-3xl rounded-[2rem] border border-white/70 bg-[var(--color-surface)]/[0.72] p-4 shadow-[0_24px_80px_rgba(14,138,163,0.12)] backdrop-blur-2xl sm:p-5"
        aria-live="polite"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--color-accent-2)]">
              <Sparkles size={14} />
              <span>{previewPackage.category}</span>
            </div>
            <h3 className="mt-1.5 font-arabic text-xl font-extrabold text-[var(--color-text)] sm:text-2xl">{previewPackage.name}</h3>
            <p className="mt-1 line-clamp-1 font-arabic text-sm leading-7 text-[var(--color-muted)]">{previewPackage.description}</p>
          </div>
          <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
            <PriceWithRiyal amount={previewPackage.price} size="lg" />
            <button
              type="button"
              onClick={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                openDetails(previewPackage, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-text)] px-5 py-2.5 font-arabic text-sm font-extrabold text-[var(--color-surface)] transition hover:-translate-y-0.5 hover:bg-[var(--color-accent-2)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            >
              تفاصيل الباقة
              <MousePointerClick size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      <div className="mt-4 flex flex-col items-center justify-center gap-1 text-center font-arabic text-xs text-[var(--color-muted)] sm:flex-row sm:gap-3">
        <span>المسار يتحرك بشكل مستمر</span>
        <span className="hidden h-1 w-1 rounded-full bg-[var(--color-accent)] sm:block" />
        <span>مرر المؤشر لرفع الباقة واضغط عليها للتفاصيل</span>
        <Link href="/project-request" className="mt-2 font-extrabold text-[var(--color-accent-2)] underline underline-offset-4 sm:mt-0">أو اطلب عرض مخصص</Link>
      </div>

      <ul className="sr-only" aria-label="قائمة الباقات النصية">
        {packages.map((pkg) => (
          <li key={pkg.id}>
            <strong>{pkg.name}</strong>: {pkg.description} — {pkg.price.toLocaleString('ar-SA')} ريال
          </li>
        ))}
      </ul>

      <PackageDetailsModal
        isOpen={!!openPackage}
        onClose={() => setOpenPackage(null)}
        package={openPackage?.package}
        origin={openPackage?.origin}
      />
    </div>
  );
}
