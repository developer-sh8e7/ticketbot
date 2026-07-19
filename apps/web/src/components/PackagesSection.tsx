'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  Clock,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LayoutTemplate,
  LifeBuoy,
  ShoppingCart,
  Smartphone,
  X,
} from 'lucide-react';

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

type Package = (typeof packages)[number];

const CARD_FEATURE_COUNT = 4;

/* One artwork per package, in display order. object-position keeps each
   image's brightest zone behind the dark heading text and pushes the deep
   teal areas toward the card bottom where the opaque CTA sits. */
const CARD_ART = [
  { src: '/cards/bgahcard-1.png', position: '20% 0%' },
  { src: '/cards/bgahcard-2.png', position: '0% 0%' },
  { src: '/cards/bgahcard-3.png', position: '50% 30%' },
  { src: '/cards/bgahcard-4.png', position: '100% 0%' },
  { src: '/cards/bgahcard-5.png', position: '0% 0%' },
] as const;

function PackagePrice({ pkg, size = 'card' }: { pkg: Package; size?: 'card' | 'modal' }) {
  return (
    <span className={`pkg-price-row ${size === 'modal' ? 'pkg-price-row-modal' : ''}`}>
      <span className="pkg-price">
        {pkg.price.toLocaleString('ar-SA')}
        <small>ر.س</small>
      </span>
      {pkg.originalPrice > pkg.price ? (
        <s className="pkg-price-old">{pkg.originalPrice.toLocaleString('ar-SA')} ر.س</s>
      ) : null}
      {pkg.discount > 0 ? <span className="pkg-price-save">وفر {pkg.discount}%</span> : null}
    </span>
  );
}

function PackageCard({
  pkg,
  index,
  dimmed,
  selected,
  onOpen,
}: {
  pkg: Package;
  index: number;
  dimmed: boolean;
  selected: boolean;
  onOpen: (pkg: Package, trigger: HTMLElement) => void;
}) {
  const Icon = pkg.icon;
  const art = CARD_ART[index % CARD_ART.length];
  return (
    <motion.article
      initial={{ opacity: 0, y: 26 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.5, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={`pkg-card ${pkg.popular ? 'pkg-card-featured' : ''} ${dimmed ? 'is-dimmed' : ''} ${selected ? 'is-selected' : ''}`}
    >
      <span className="pkg-card-art" aria-hidden="true">
        <Image
          src={art.src}
          alt=""
          fill
          sizes="(max-width: 639px) 92vw, (max-width: 1023px) 46vw, 30vw"
          quality={82}
          className="pkg-card-art-img"
          style={{ objectPosition: art.position }}
        />
        <span className="pkg-card-art-veil" />
      </span>
      <button
        type="button"
        className="pkg-card-body font-arabic"
        onClick={(event) => onOpen(pkg, event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={selected}
        aria-label={`عرض تفاصيل باقة ${pkg.name}`}
      >
        <span className="pkg-card-top">
          <span className="pkg-chip">
            <Icon size={21} strokeWidth={1.9} />
          </span>
          {pkg.popular ? <span className="pkg-card-badge">الأكثر طلبًا</span> : null}
        </span>

        <span className="pkg-card-category">{pkg.category}</span>
        <strong className="pkg-card-name">{pkg.name}</strong>
        <span className="pkg-card-desc">{pkg.description}</span>

        <PackagePrice pkg={pkg} />

        <span className="pkg-card-divider" aria-hidden="true" />

        <ul className="pkg-features">
          {pkg.features.slice(0, CARD_FEATURE_COUNT).map((feature) => (
            <li key={feature}>
              <span className="pkg-check">
                <Check size={11} strokeWidth={3} />
              </span>
              {feature}
            </li>
          ))}
        </ul>
        {pkg.features.length > CARD_FEATURE_COUNT ? (
          <span className="pkg-card-more-count">و{pkg.features.length - CARD_FEATURE_COUNT} ميزات أخرى ضمن الباقة</span>
        ) : null}

        <span className="pkg-card-cta">
          عرض التفاصيل والطلب
          <span className="pkg-card-cta-arrow">
            <ArrowLeft size={15} />
          </span>
        </span>
      </button>
    </motion.article>
  );
}

function PackageModal({ pkg, onClose }: { pkg: Package | null; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!pkg) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab' || !panelRef.current) return;

      const focusable = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [pkg, onClose]);

  return (
    <AnimatePresence>
      {pkg ? (
        <motion.div
          className="pkg-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={pkg.name}
            dir="rtl"
            className="pkg-modal font-arabic"
            initial={{ opacity: 0, y: 64, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 48, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            <span className="pkg-modal-handle" aria-hidden="true" />

            <div className="pkg-modal-head">
              <span className="pkg-chip">
                <pkg.icon size={22} strokeWidth={1.9} />
              </span>
              <div className="pkg-modal-titles">
                <span className="pkg-card-category">{pkg.category}</span>
                <strong className="pkg-modal-name">{pkg.name}</strong>
              </div>
              <button type="button" onClick={onClose} className="pkg-modal-close" aria-label="إغلاق">
                <X size={18} />
              </button>
            </div>

            <p className="pkg-modal-desc">{pkg.description}</p>

            <div className="pkg-modal-meta">
              <span>
                <Clock size={15} />
                {pkg.deliveryTime}
              </span>
              <span>
                <BadgeCheck size={15} />
                {pkg.quality}
              </span>
              <span>
                <LifeBuoy size={15} />
                {pkg.support}
              </span>
            </div>

            <ul className="pkg-features pkg-modal-features">
              {pkg.features.map((feature) => (
                <li key={feature}>
                  <span className="pkg-check">
                    <Check size={11} strokeWidth={3} />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="pkg-modal-footer">
              <PackagePrice pkg={pkg} size="modal" />
              <Link href="/project-request" className="pkg-modal-cta">
                اطلب هذه الباقة
                <ArrowLeft size={16} />
              </Link>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export function PackagesSection({ initialCategory = 'all' }: { initialCategory?: string }) {
  const [selectedCategory, setSelectedCategory] = useState(
    validCategories.has(initialCategory) ? initialCategory : 'all'
  );
  const [activePackage, setActivePackage] = useState<Package | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

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

  const openPackage = (pkg: Package, trigger: HTMLElement) => {
    triggerRef.current = trigger;
    setActivePackage(pkg);
  };

  const closePackage = () => {
    setActivePackage(null);
    triggerRef.current?.focus();
  };

  return (
    <div dir="rtl" className="relative">
      <div className="relative z-10">
        {/* Category Tabs */}
        <div
          className="opus-horizontal-track -mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 sm:mx-0 sm:flex-wrap sm:items-center sm:justify-center sm:overflow-visible sm:px-0"
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

        <div className="packages-grid mt-6 grid items-stretch gap-4 sm:mt-8 sm:grid-cols-2 md:gap-5 lg:grid-cols-6">
          {packages.map((pkg, index) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              index={index}
              dimmed={Boolean(focusId && focusId !== pkg.id)}
              selected={activePackage?.id === pkg.id}
              onOpen={openPackage}
            />
          ))}
        </div>

        <p className="mt-8 text-center font-arabic text-xs text-[var(--color-muted)] sm:text-sm">
          اضغط على أي باقة لعرض تفاصيلها الكاملة وطلبها،{' '}
          <Link
            href="/project-request"
            className="font-extrabold text-[var(--color-accent-2)] underline underline-offset-4"
          >
            أو اطلب عرض مخصص
          </Link>
        </p>

        <ul className="sr-only" aria-label="قائمة الباقات النصية">
          {packages.map((pkg) => (
            <li key={pkg.id}>
              <strong>{pkg.name}</strong>: {pkg.description} — {pkg.price.toLocaleString('ar-SA')} ريال
            </li>
          ))}
        </ul>
      </div>

      <PackageModal pkg={activePackage} onClose={closePackage} />
    </div>
  );
}
