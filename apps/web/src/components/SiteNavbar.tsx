'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { LayoutDashboard, LogOut, Menu, ShoppingCart, X, Package, ShoppingCart as CartIcon, ShoppingBag, Rocket, FileText } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useCart } from '@/components/cart/CartProvider';

const SUPPORT_URL = 'https://discord.gg/WRL';

const links: { label: string; href: string; icon: React.ComponentType<{ size?: number }> }[] = [
  { label: 'الرئيسية', href: '/', icon: FileText },
  { label: 'الباقات', href: '/#packages', icon: Package },
  { label: 'BOTS Discord', href: '/bots', icon: Rocket },
  { label: 'اطلب موقعك أو تطبيقك', href: '/project-request', icon: ShoppingBag },
];

type SessionUser = { discord_user_id: string; username: string | null; avatar: string | null };

function discordAvatarUrl(user: SessionUser) {
  if (user.avatar && user.avatar.length > 0) {
    return `https://cdn.discordapp.com/avatars/${user.discord_user_id}/${user.avatar}.png?size=64`;
  }
  return null;
}

export function SiteNavbar() {
  const pathname = usePathname();
  const isDiscordArea = ['/bots', '/commands', '/pricing', '/cart', '/dashboard', '/login'].some((path) =>
    pathname.startsWith(path)
  ) || (pathname.startsWith('/product/') && !pathname.startsWith('/product/custom'));
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const { count, openCart } = useCart();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!isDiscordArea) {
      setAuthChecked(true);
      return undefined;
    }

    let active = true;
    fetch('/api/dashboard/me', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (active && json?.success && json.data) setUser(json.data as SessionUser);
      })
      .catch(() => {})
      .finally(() => active && setAuthChecked(true));
    return () => {
      active = false;
    };
  }, [isDiscordArea]);

  const isElevated = scrolled || open;
  const avatar = user ? discordAvatarUrl(user) : null;
  const visibleLinks = isDiscordArea ? [...links, { label: 'الدعم الفني', href: SUPPORT_URL, icon: FileText }] : links;

  const CartButton = (
    <button
      type="button"
      onClick={openCart}
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-opus-border text-opus-text transition hover:border-opus-accent"
      aria-label="السلة"
    >
      <CartIcon size={18} />
      {count > 0 ? (
        <span className="absolute -right-1.5 -top-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-opus-accent px-1 font-english text-[11px] font-bold text-black">
          {count}
        </span>
      ) : null}
    </button>
  );

  const AuthArea = () => {
    if (!authChecked) {
      return <div className="h-10 w-28 animate-pulse rounded-xl bg-opus-surface" />;
    }
    if (user) {
      return (
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-opus-border px-3 py-2 text-sm font-bold text-opus-text transition hover:border-opus-accent"
          >
            {avatar ? (
              <Image src={avatar} alt="" width={22} height={22} className="rounded-full" />
            ) : (
              <LayoutDashboard size={16} />
            )}
            <span className="max-w-28 truncate">{user.username || 'حسابي'}</span>
          </Link>
          <a
            href="/api/logout"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-opus-border text-opus-muted transition hover:border-red-500/60 hover:text-red-400"
            aria-label="تسجيل خروج"
          >
            <LogOut size={16} />
          </a>
        </div>
      );
    }
    return (
      <a
        href="/api/auth/discord"
        className="inline-flex items-center gap-2 rounded-xl bg-[#5865F2] px-4 py-2 text-sm font-bold text-white transition hover:opacity-90"
      >
        <svg viewBox="0 0 127 96" width="18" height="14" fill="currentColor" aria-hidden="true">
          <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.37 72.37 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.7 77.7 0 0 0 6.89-11.11 68.42 68.42 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2a75.57 75.57 0 0 0 64.32 0c.87.71 1.76 1.39 2.66 2a68.68 68.68 0 0 1-10.87 5.19 77 77 0 0 0 6.89 11.1 105.25 105.25 0 0 0 32.19-16.14c2.64-27.38-4.51-51.11-18.9-72.15ZM42.45 65.69C36.18 65.69 31 60 31 53s5-12.74 11.43-12.74S54 46 53.89 53s-5.05 12.69-11.44 12.69Zm42.24 0C78.41 65.69 73.25 60 73.25 53s5-12.74 11.44-12.74S96.23 46 96.12 53s-5.04 12.69-11.43 12.69Z" />
        </svg>
        <span>تسجيل الدخول</span>
      </a>
    );
  };

  return (
    <nav
      dir="rtl"
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-200 ${
        isElevated
          ? 'border-opus-border bg-[var(--navbar-bg)] shadow-[0_10px_35px_rgba(45,40,32,0.06)] backdrop-blur-[12px]'
          : 'border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 py-3 sm:gap-4 md:grid-cols-[1fr_auto_1fr] md:px-8 lg:px-12">
        <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3" onClick={() => setOpen(false)}>
          <Image
            src="https://i.imgur.com/0404vFj.png"
            alt="Opus Solutions"
            width={44}
            height={44}
            className="h-10 w-10 shrink-0 rounded-full sm:h-11 sm:w-11"
            priority
          />
          <span className="truncate font-arabic text-base font-extrabold tracking-tight text-opus-text min-[350px]:text-lg">Opus Solutions</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {visibleLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              target={href === SUPPORT_URL ? '_blank' : undefined}
              rel={href === SUPPORT_URL ? 'noopener noreferrer' : undefined}
              className="nav-link flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-opus-muted transition hover:text-opus-text focus:outline-none"
            >
              <Icon size={16} />
              {label}
            </Link>
          ))}
        </div>

        {isDiscordArea ? (
          <div className="hidden items-center gap-3 md:flex">
            {CartButton}
            <AuthArea />
          </div>
        ) : null}

        <div className="flex items-center gap-2 md:hidden">
          {isDiscordArea ? CartButton : null}
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-opus-border bg-opus-surface text-opus-text transition hover:border-opus-accent"
            aria-expanded={open}
            aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      <motion.div
        initial={false}
        animate={open ? { height: 'auto', opacity: 1, y: 0 } : { height: 0, opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className={`max-h-[calc(100dvh-68px)] overflow-y-auto border-t bg-[var(--navbar-bg)] backdrop-blur-[12px] md:hidden ${
          open ? 'border-opus-border' : 'border-transparent'
        }`}
      >
        <div className="grid gap-1 px-4 py-4 text-sm">
          {visibleLinks.map(({ label, href, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              target={href === SUPPORT_URL ? '_blank' : undefined}
              rel={href === SUPPORT_URL ? 'noopener noreferrer' : undefined}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-4 py-3 font-semibold text-opus-muted transition hover:bg-opus-surface hover:text-opus-text"
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          {isDiscordArea ? <div className="mt-2 border-t border-opus-border pt-3">
            {user ? (
              <div className="grid gap-1">
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="rounded-xl px-4 py-3 font-bold text-opus-text transition hover:bg-opus-surface"
                >
                  لوحة التحكم
                </Link>
                <a href="/api/logout" className="rounded-xl px-4 py-3 font-bold text-red-400 transition hover:bg-opus-surface">
                  تسجيل خروج
                </a>
              </div>
            ) : (
              <a
                href="/api/auth/discord"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5865F2] px-4 py-3 font-bold text-white"
              >
                تسجيل الدخول عبر Discord
              </a>
            )}
          </div> : null}
        </div>
      </motion.div>
    </nav>
  );
}
