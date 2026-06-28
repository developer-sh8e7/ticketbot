'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const links: [string, string][] = [
  ['الرئيسية', '/'],
  ['الأوامر', '/commands'],
  ['الأسعار', '/pricing'],
];

export function SiteNavbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const isElevated = scrolled || open;

  return (
    <nav
      dir="rtl"
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${
        isElevated
          ? 'border-[var(--color-border)] bg-[var(--navbar-bg)] backdrop-blur-[12px]'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8 lg:px-12">
        <Link href="/" className="flex items-center gap-3" onClick={() => setOpen(false)}>
          <Image
            src="https://i.imgur.com/0404vFj.png"
            alt="Opus Solutions"
            width={44}
            height={44}
            className="rounded-full"
            priority
          />
          <span className="font-arabic text-lg font-extrabold tracking-tight text-[var(--color-text)]">
            Opus Solutions
          </span>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {links.map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="nav-link rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-muted)] transition hover:text-[var(--color-text)] focus:outline-none"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/login"
            className="rounded-xl border border-[var(--color-accent)] px-4 py-2 text-sm font-bold text-[var(--color-accent)] transition hover:bg-[var(--color-accent)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
          >
            Dashboard
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] transition hover:border-[var(--color-accent)] md:hidden"
          aria-expanded={open}
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      <motion.div
        initial={false}
        animate={open ? { height: 'auto', opacity: 1, y: 0 } : { height: 0, opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={`overflow-hidden border-t bg-[var(--navbar-bg)] backdrop-blur-[12px] md:hidden ${open ? 'border-[var(--color-border)]' : 'border-transparent'}`}

      >
        <div className="grid gap-1 px-4 py-4 text-sm">
          {[...links, ['Dashboard', '/login']].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 font-semibold text-[var(--color-muted)] transition hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
            >
              {label}
            </Link>
          ))}
        </div>
      </motion.div>
    </nav>
  );
}
