'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  RotateCcw,
  Headphones,
  Shield,
  Zap,
  Palette,
  Code2,
  Globe,
  Users,
  Target,
} from 'lucide-react';
import { PublicFrame } from '@/components/ui';
import { PackagesSection } from '@/components/PackagesSection';

export default function PackagesPage() {
  return (
    <Suspense fallback={null}>
      <PackagesContent />
    </Suspense>
  );
}

function PackagesContent() {
  const searchParams = useSearchParams();
  const catParam = searchParams.get('cat') ?? 'all';

  return (
    <PublicFrame>
    <div dir="rtl">
      {/* Hero Section */}
      <section className="relative -mt-28 mx-[calc(50%-50vw)] w-screen overflow-hidden pb-12 pt-36 md:pb-16 md:pt-44">
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-accent)]/5 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-8 lg:px-12 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-balance font-arabic text-4xl font-extrabold tracking-tight text-[var(--color-text)] md:text-5xl lg:text-6xl"
          >
            اختر الباقة المناسبة<br />
            <span className="text-[var(--color-accent)]">وابدأ مشروعك</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 mx-auto max-w-2xl font-arabic text-lg leading-8 text-[var(--color-muted)]"
          >
            أسعار ثابتة، مميزات شاملة، لا رسوم مخفية. كل باقة تتضمن تصميم، برمجة، تسليم، ودعم فني لمدة أسبوع.
          </motion.p>
        </div>
      </section>

      {/* Packages Grid */}
      <section id="packages" className="pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
          <PackagesSection initialCategory={catParam} />
        </div>
      </section>

      {/* What's Included Section */}
      <section className="border-y border-white/60 bg-[var(--color-surface)]/[0.58] py-16 backdrop-blur-xl md:py-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
          <div className="text-center mb-16">
            <h2 className="font-arabic text-3xl font-extrabold text-[var(--color-text)] md:text-4xl">
              كل باقة تتضمن
            </h2>
            <p className="mt-3 font-arabic text-[var(--color-muted)] max-w-2xl mx-auto">
              لا رسوم مخفية، لا مفاجآت. السعر يشمل كل شيء من التصميم للتسليم والدعم.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Palette, title: 'تصميم مخصص', desc: 'ليس قوالب جاهزة — نصمم لكل مشروع هويته الخاصة' },
              { icon: Code2, title: 'برمجة نظيفة', desc: 'كود منظم، موثق، قابل للصيانة والتوسع مستقبلاً' },
              { icon: Globe, title: 'متجاوب 100%', desc: 'يعمل بسلاسة على الجوال، التابلت، الديسكتوب' },
              { icon: Zap, title: 'أداء سريع', desc: 'تحسين Core Web Vitals، تحميل في أقل من 3 ثوانٍ' },
              { icon: Shield, title: 'أمان وحماية', desc: 'SSL، حماية من الهجمات، نسخ احتياطية يومية' },
              { icon: Users, title: 'تدريب وتسليم', desc: 'جلسة تدريب مسجلة + توثيق مكتوب لإدارة المشروع' },
              { icon: Target, title: 'SEO جاهز', desc: 'هيكل تقني محسّن لمحركات البحث من اليوم الأول' },
              { icon: Headphones, title: 'دعم فني أسبوع', desc: 'دعم مجاني لمدة أسبوع + أولوية في الاستجابة' },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]/50 transition-colors"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-accent)]/10 text-[var(--color-accent)] group-hover:bg-[var(--color-accent)] group-hover:text-white transition-colors">
                  <item.icon size={22} />
                </div>
                <h3 className="mt-4 font-arabic text-base font-extrabold text-[var(--color-text)]">{item.title}</h3>
                <p className="mt-2 font-arabic text-sm text-[var(--color-muted)]">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Transparency details */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-4 md:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h2 className="font-arabic text-3xl font-extrabold text-[var(--color-text)] md:text-4xl">
              تفاصيل مهمة
            </h2>
            <p className="mt-3 font-arabic text-[var(--color-muted)]">
              نقاط توضيحية لضمان الشفافية الكاملة قبل البدء.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                title: 'مدة التسليم',
                desc: 'تقديرية حسب حجم المشروع، المتطلبات، والتعديلات المضافة أثناء العمل. نتفق على جدول زمني واضح قبل البدء.',
              },
              {
                title: 'الدعم الفني',
                desc: 'دعم فني مجاني لمدة أسبوع بعد التسليم يشمل إصلاح الأخطاء، توضيح الاستخدام، وتعديلات بسيطة.',
              },
              {
                title: 'الاستضافة والدومين',
                desc: 'السعر يشمل التصميم والبرمجة والتسليم. الاستضافة والدومين خدمة منفصلة أو نربط استضافتك الحالية.',
              },
              {
                title: 'إدارة المحتوى',
                desc: 'جميع المشاريع تتضمن لوحة تحكم عربية (CMS) تتيح لك تعديل المحتوى، الصور، والمنتجات ذاتياً.',
              },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-50px' }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="group p-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] hover:border-[var(--color-accent)]/50 transition-colors"
              >
                <h3 className="font-arabic text-base font-extrabold text-[var(--color-text)] flex items-center gap-2">
                  <RotateCcw size={18} className="text-[var(--color-accent)]" />
                  {item.title}
                </h3>
                <p className="mt-2 font-arabic text-sm text-[var(--color-muted)]">{item.desc}</p>
              </motion.div>
            ))}
          </div>

          <p className="mt-8 text-center font-arabic text-sm text-[var(--color-muted)]">
            التفاصيل الكاملة لسياسة العمل والتعديلات موجودة في{' '}
            <Link href="/terms" className="font-extrabold text-[var(--color-accent)] underline underline-offset-4 hover:text-[var(--color-accent-2)]">
              الشروط والأحكام
            </Link>
          </p>
        </div>
      </section>

      {/* CTA Section */}
      <section className="pb-16 md:pb-24">
        <div className="mx-auto max-w-7xl px-4 md:px-8 lg:px-12">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-accent)] via-[var(--color-accent)]/90 to-[var(--color-accent-2)] p-8 md:p-12 lg:p-16 text-center">
            <div className="relative z-10">
              <h2 className="font-arabic text-3xl font-extrabold text-white md:text-4xl lg:text-5xl">
                لم تجد ما يناسبك تماماً؟
              </h2>
              <p className="mt-4 mx-auto max-w-xl text-lg text-white/90 font-arabic">
                كل مشروع مختلف. حدّد متطلباتك وسنرسل لك عرض سعر مخصص خلال 24 ساعة.
              </p>
              <Link
                href="/project-request"
                className="mt-8 inline-flex items-center justify-center gap-2 rounded-xl bg-white px-8 py-3.5 font-arabic text-base font-extrabold text-[var(--color-accent)] transition hover:bg-white/90 hover:-translate-y-0.5"
              >
                اطلب عرض سعر مخصص <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
    </PublicFrame>
  );
}
