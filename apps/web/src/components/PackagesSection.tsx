'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ShoppingCart,
  LayoutDashboard,
  GraduationCap,
  LayoutTemplate,
  Smartphone,
  Check,
  Award,
  Headphones,
  Handshake,
  Layers,
} from 'lucide-react';
import { PackageDetailsModal } from '@/components/PackageDetailsModal';
import { PriceWithRiyal, DiscountBadge, StrikethroughPrice } from '@/components/RiyalIcon';

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

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

export function PackagesSection({ initialCategory = 'all' }: { initialCategory?: string }) {
  const [selectedCategory, setSelectedCategory] = useState(
    validCategories.has(initialCategory) ? initialCategory : 'all'
  );
  const [openPackage, setOpenPackage] = useState<typeof packages[0] | null>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelectedCategory(validCategories.has(initialCategory) ? initialCategory : 'all');
  }, [initialCategory]);

  useEffect(() => {
    const onSelect = (event: Event) => {
      const category = (event as CustomEvent<string>).detail;
      if (validCategories.has(category)) setSelectedCategory(category);
    };
    window.addEventListener(SELECT_CATEGORY_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_CATEGORY_EVENT, onSelect);
  }, []);

  useEffect(() => {
    cardsRef.current?.scrollTo({ left: 0, behavior: 'smooth' });
  }, [selectedCategory]);

  const filteredPackages = selectedCategory === 'all'
    ? packages
    : packages.filter((p) => p.id === selectedCategory);

  return (
    <div dir="rtl">
      {/* Category Tabs */}
      <div
        className="opus-horizontal-track -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:items-center sm:justify-center sm:overflow-visible sm:px-0"
        role="tablist"
        aria-label="تصنيف الباقات"
      >
        {packageCategories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            role="tab"
            aria-selected={selectedCategory === cat.id}
            className={`inline-flex min-h-11 shrink-0 snap-start items-center gap-2 rounded-xl px-3.5 py-2.5 font-arabic text-sm font-bold transition-all duration-200 sm:rounded-2xl sm:px-4 ${
              selectedCategory === cat.id
                ? 'bg-[var(--color-accent)] text-white shadow-[0_8px_30px_rgba(232,108,0,0.3)]'
                : 'bg-[var(--color-surface)] text-[var(--color-muted)] border border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:text-[var(--color-text)]'
            }`}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-center font-arabic text-xs text-[var(--color-muted)] sm:hidden">اسحب للتنقل بين التصنيفات والباقات</p>

      {/* Cards */}
      <motion.div
        ref={cardsRef}
        key={selectedCategory}
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="opus-horizontal-track -mx-4 mt-7 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-5 pt-4 md:mx-0 md:mt-10 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pt-4 lg:grid-cols-3"
        aria-label="الباقات المتاحة"
        aria-live="polite"
      >
        {filteredPackages.map((pkg) => (
          <PackageCard key={pkg.id} pkg={pkg} onDetails={() => setOpenPackage(pkg)} />
        ))}
      </motion.div>

      <PackageDetailsModal
        isOpen={!!openPackage}
        onClose={() => setOpenPackage(null)}
        package={openPackage!}
      />
    </div>
  );
}

function PackageCard({ pkg, onDetails }: { pkg: typeof packages[0]; onDetails: () => void }) {
  const Icon = pkg.icon;
  const isPopular = pkg.popular;

  return (
    <motion.article
      variants={itemVariants}
      className={`relative flex h-full min-w-[calc(100vw-3rem)] snap-center flex-col rounded-3xl border bg-[var(--color-surface)] transition-all duration-300 sm:min-w-[380px] md:min-w-0 ${
        isPopular
          ? 'border-[var(--color-accent)]/60 shadow-[0_16px_50px_rgba(232,108,0,0.14)]'
          : 'border-[var(--color-border)] shadow-[0_2px_12px_rgba(45,40,32,0.04)] hover:border-[var(--color-accent)]/40 hover:shadow-[0_20px_50px_rgba(232,108,0,0.1)]'
      }`}
    >
      {isPopular && (
        <span className="absolute -top-3.5 right-6 rounded-full bg-[var(--color-accent)] px-4 py-1 font-arabic text-xs font-extrabold text-white shadow-[0_6px_18px_rgba(232,108,0,0.35)]">
          الأكثر طلبا
        </span>
      )}

      <div className="flex flex-1 flex-col p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${isPopular ? 'bg-[var(--color-accent)] text-white' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'}`}>
            <Icon size={26} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-arabic text-xl font-extrabold text-[var(--color-text)]">{pkg.name}</h3>
            <p className="mt-0.5 font-arabic text-xs font-bold text-[var(--color-muted)]">{pkg.category}</p>
          </div>
        </div>

        <p className="mt-4 font-arabic text-sm leading-7 text-[var(--color-muted)] line-clamp-2">{pkg.description}</p>

        <div className="mt-6 rounded-2xl bg-[var(--color-bg)] p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <PriceWithRiyal amount={pkg.price} size="xl" />
            {pkg.originalPrice > pkg.price && <StrikethroughPrice amount={pkg.originalPrice} size="lg" />}
            {pkg.discount > 0 && <DiscountBadge original={pkg.originalPrice} current={pkg.price} />}
          </div>
          <p className="mt-2 font-arabic text-xs font-semibold text-[var(--color-muted)]">سعر شامل التصميم والبرمجة والتسليم — لا رسوم مخفية</p>
        </div>

        <ul className="mt-5 grid gap-2.5">
          <Fact icon={Handshake} label="التسليم" value="تقديري حسب المشروع" />
          <Fact icon={Award} label="الجودة" value="احترافية 100%" />
          <Fact icon={Headphones} label="الدعم الفني" value="لمدة أسبوع بعد التسليم" />
        </ul>

        <div className="mt-5 flex-1 border-t border-[var(--color-border)] pt-5">
          <p className="mb-3 font-arabic text-sm font-extrabold text-[var(--color-text)]">أبرز ما تشمله الباقة</p>
          <ul className="grid gap-2">
            {pkg.features.slice(0, 4).map((feature, i) => (
              <li key={i} className="flex items-start gap-2.5 font-arabic text-sm leading-6 text-[var(--color-muted)]">
                <Check size={15} className="mt-1 shrink-0 text-[var(--color-accent)]" />
                <span className="line-clamp-1">{feature}</span>
              </li>
            ))}
          </ul>
          {pkg.features.length > 4 && (
            <button onClick={onDetails} className="mt-3 font-arabic text-sm font-extrabold text-[var(--color-accent)] transition hover:text-[var(--color-accent-2)]">
              +{pkg.features.length - 4} ميزة أخرى — عرض الكل
            </button>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-2.5 min-[360px]:grid-cols-2 min-[360px]:gap-3">
          <Link
            href="/project-request"
            className={`inline-flex items-center justify-center rounded-xl px-5 py-3 font-arabic text-sm font-extrabold transition hover:-translate-y-0.5 ${
              isPopular
                ? 'bg-[var(--color-accent)] text-white hover:opacity-90'
                : 'bg-[var(--color-text)] text-[var(--color-bg)] hover:opacity-90'
            }`}
          >
            ابدأ مشروعك
          </Link>
          <button
            onClick={onDetails}
            className="rounded-xl border border-[var(--color-border)] px-5 py-3 font-arabic text-sm font-bold text-[var(--color-text)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-accent)]"
          >
            تفاصيل الباقة
          </button>
        </div>
      </div>
    </motion.article>
  );
}

function Fact({ icon: Icon, label, value }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; value: string }) {
  return (
    <li className="flex items-center gap-3 font-arabic text-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]/10 text-[var(--color-accent)]">
        <Icon size={15} />
      </span>
      <span className="text-[var(--color-muted)]">{label}:</span>
      <span className="font-bold text-[var(--color-text)]">{value}</span>
    </li>
  );
}
