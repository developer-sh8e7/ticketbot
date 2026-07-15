'use client';

import Link from 'next/link';
import { ArrowLeft, BriefcaseBusiness, GraduationCap, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'opus_welcome_seen_v1';

export function WelcomeIntro() {
  const [open, setOpen] = useState(false);
  const skipRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (window.localStorage.getItem(STORAGE_KEY)) return;
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    skipRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') dismiss();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, '1');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm" role="presentation">
      <section
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
        className="relative max-h-[calc(100vh-2rem)] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl sm:p-10"
      >
        <button
          ref={skipRef}
          type="button"
          onClick={dismiss}
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--color-border)] text-[var(--color-muted)] transition hover:border-[var(--color-accent)] hover:text-[var(--color-text)]"
          aria-label="تخطي وإغلاق الترحيب"
        >
          <X size={19} />
        </button>

        <p className="font-arabic text-sm font-bold text-[var(--color-accent)]">أهلًا بك في Opus</p>
        <h2 id="welcome-title" className="mt-4 max-w-2xl text-balance font-arabic text-3xl font-extrabold leading-tight text-[var(--color-text)] sm:text-5xl">
          الفكرة عندك، والتنفيذ علينا
        </h2>
        <p className="mt-5 max-w-2xl text-balance font-arabic text-base leading-8 text-[var(--color-muted)] sm:text-lg">
          رائد أعمال وفكرة تطبيقك عالقة في الملاحظات؟ أو طالب جامعي وموعد التسليم يقرّب؟ وصلت للمكان الصح. نرتّب فكرتك ونحوّلها إلى مشروع متكامل يطلع بالشكل الذي يليق فيك.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link
            href="/project-request?for=business"
            onClick={dismiss}
            className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 transition hover:border-[var(--color-accent)]"
          >
            <BriefcaseBusiness size={24} className="text-[var(--color-accent)]" />
            <h3 className="mt-4 font-arabic text-lg font-extrabold text-[var(--color-text)]">عندي فكرة أو مشروع</h3>
            <p className="mt-2 font-arabic text-sm leading-7 text-[var(--color-muted)]">أبي أحوّل الفكرة إلى منتج فعلي ومرتب.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-arabic text-sm font-bold text-[var(--color-accent-2)]">
              نبدأ سوا <ArrowLeft size={15} className="transition group-hover:-translate-x-1" />
            </span>
          </Link>

          <Link
            href="/project-request?for=student"
            onClick={dismiss}
            className="group rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg)] p-5 transition hover:border-[var(--color-accent)]"
          >
            <GraduationCap size={24} className="text-[var(--color-accent)]" />
            <h3 className="mt-4 font-arabic text-lg font-extrabold text-[var(--color-text)]">عندي مشروع جامعي</h3>
            <p className="mt-2 font-arabic text-sm leading-7 text-[var(--color-muted)]">أحتاج تنفيذاً واضحاً وجاهزاً للعرض.</p>
            <span className="mt-5 inline-flex items-center gap-2 font-arabic text-sm font-bold text-[var(--color-accent-2)]">
              نرتّب المشروع <ArrowLeft size={15} className="transition group-hover:-translate-x-1" />
            </span>
          </Link>
        </div>

        <button type="button" onClick={dismiss} className="mt-6 w-full py-2 font-arabic text-sm font-bold text-[var(--color-muted)] underline decoration-[var(--color-border)] underline-offset-4 transition hover:text-[var(--color-text)]">
          تخطي، خلّني أتصفح أول
        </button>
      </section>
    </div>
  );
}
