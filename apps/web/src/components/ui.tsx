import Link from 'next/link';
import type { ReactNode } from 'react';
import { Bot, BrainCircuit, Code2, FileText, ShieldCheck, Ticket, Undo2, UserCheck, UserPlus, Settings2 } from 'lucide-react';
import { SiteNavbar } from '@/components/SiteNavbar';
import { cn } from '@/lib/cn';

export function Shell({ children }: { children: ReactNode }) {
  return <main className="relative z-10 mx-auto w-full max-w-7xl px-4 pb-8 pt-28 sm:px-8 lg:px-12">{children}</main>;
}

export function PublicFrame({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden">
      <Navbar />
      <Shell>{children}</Shell>
      <Footer />
    </div>
  );
}

export function Navbar() {
  return <SiteNavbar />;
}

export function Footer() {
  return (
    <footer dir="rtl" className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-8 lg:px-12">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h4 className="font-arabic text-lg font-extrabold text-[var(--color-text)]">Opus Solutions</h4>
            <p className="mt-3 max-w-xs font-arabic text-sm leading-7 text-[var(--color-muted)]">
              نحوّل الأفكار إلى مشاريع رقمية واضحة، مرتبة، وجاهزة للاستخدام.
            </p>
          </div>
          <FooterGroup title="الصفحات" links={[['الرئيسية', '/'], ['BOTS Discord', '/bots'], ['اطلب مشروعك', '/project-request']]} />
          <FooterGroup title="الشروط والسياسات" links={[['شروط الاستخدام', '/terms'], ['سياسة الخصوصية', '/privacy'], ['الإلغاء والاسترداد', '/cancellation']]} />
        </div>
        <div className="mt-12 border-t border-[var(--color-border)] pt-6 text-center text-xs text-[var(--color-muted)]">
          © {new Date().getFullYear()} Opus Solutions
        </div>
      </div>
    </footer>
  );
}

function FooterGroup({ title, links }: { title: string; links: [string, string][] }) {
  const icons: Record<string, ReactNode> = {
    '/terms': <FileText size={16} className="text-[var(--color-accent)]" />,
    '/privacy': <ShieldCheck size={16} className="text-[var(--color-accent)]" />,
    '/cancellation': <Undo2 size={16} className="text-[var(--color-accent)]" />,
  };

  return (
    <div>
      <h4 className="mb-4 font-arabic text-sm font-extrabold text-[var(--color-text)]">{title}</h4>
      <div className="grid gap-3 text-sm text-[var(--color-muted)]">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className="inline-flex w-fit items-center gap-2 transition hover:text-[var(--color-text)]">
            {icons[href] ?? null}
            <span>{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 ${className}`}>{children}</section>;
}

type ButtonVariant = 'solid' | 'outline';
type ButtonProps = { href?: string; children: ReactNode; muted?: boolean; size?: 'sm' | 'md'; external?: boolean; disabled?: boolean; variant?: ButtonVariant };

const btnBase = 'inline-flex items-center justify-center rounded-xl font-semibold transition';
const btnSize = (s: string) => s === 'sm' ? 'px-4 py-2 text-sm' : 'px-5 py-2.5 text-sm';

export function ButtonLink({ href = '#', children, muted = false, size = 'md', external, disabled, variant }: ButtonProps) {
  const isSolid = (variant ?? (muted ? 'outline' : 'solid')) === 'solid';
  const cls = cn(
    btnBase,
    btnSize(size),
    isSolid && !muted
      ? 'bg-[var(--color-accent)] text-black hover:opacity-90'
      : 'border border-[var(--color-border)] bg-transparent text-[var(--color-muted)] hover:border-[var(--color-accent)] hover:text-[var(--color-text)]',
    disabled && 'cursor-not-allowed opacity-50'
  );
  if (disabled) return <span className={cls}>{children}</span>;
  if (external || href.startsWith('http')) return <a href={href} target="_blank" rel="noreferrer" className={cls}>{children}</a>;
  return <Link href={href} className={cls}>{children}</Link>;
}

export function Badge({ children }: { children: ReactNode }) {
  return <span className="inline-flex w-fit rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1 text-xs font-semibold text-[var(--color-accent-2)]">{children}</span>;
}

export function SectionTitle({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="mb-12 text-center md:text-start">
      {eyebrow ? <Badge>{eyebrow}</Badge> : null}
      <h2 className="mt-5 max-w-3xl text-balance font-arabic text-3xl font-extrabold tracking-tight text-[var(--color-text)] md:text-4xl">{title}</h2>
      {description ? <p className="mt-4 max-w-2xl text-base leading-8 text-[var(--color-muted)] md:text-lg">{description}</p> : null}
    </div>
  );
}

const ICON_MAP: Record<string, ReactNode> = {
  Ticket: <Ticket size={22} />,
  UserPlus: <UserPlus size={22} />,
  UserCheck: <UserCheck size={22} />,
  ShieldCheck: <ShieldCheck size={22} />,
  Bot: <Bot size={22} />,
  BrainCircuit: <BrainCircuit size={22} />,
  Settings2: <Settings2 size={22} />,
  Code2: <Code2 size={22} />,
};

export function ProductIcon({ name, className }: { name: string; className?: string }) {
  return <span className={className}>{ICON_MAP[name] || null}</span>;
}

export function StatusDot({ status }: { status: string }) {
  const dotMap: Record<string, { color: string; label: string }> = {
    active: { color: 'bg-green-400', label: 'نشط' },
    expired: { color: 'bg-red-500', label: 'منتهي' },
    cancelled: { color: 'bg-red-500', label: 'ملغي' },
    revoked: { color: 'bg-red-500', label: 'ملغي' },
    unused: { color: 'bg-yellow-400', label: 'قريبًا' },
    claimed: { color: 'bg-yellow-400', label: 'قريبًا' },
    suspended: { color: 'bg-yellow-400', label: 'معلق' },
    inactive: { color: 'bg-yellow-400', label: 'غير نشط' },
  };
  const dot = dotMap[status.toLowerCase()] || { color: 'bg-gray-400', label: status };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block w-2.5 h-2.5 rounded-full ${dot.color} shrink-0`} />
      <span>{dot.label}</span>
    </span>
  );
}
