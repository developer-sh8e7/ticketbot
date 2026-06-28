import Link from 'next/link';
import { Card, Navbar } from './ui';

const customerLinks = [
  ['الرئيسية', '/dashboard'],
  ['البوت', '/dashboard/bot'],
  ['التذاكر', '/dashboard/tickets'],
  ['الفواتير', '/dashboard/billing'],
  ['الأمان', '/dashboard/security'],
];
const adminLinks = [
  ['الإدارة', '/admin'],
  ['الطلبات', '/admin/orders'],
  ['أكواد التفعيل', '/admin/activation-codes'],
  ['البوتات', '/admin/bots'],
];

export function DashboardShell({ title, children, admin = false }: { title: string; children: React.ReactNode; admin?: boolean }) {
  const links = admin ? adminLinks : customerLinks;
  return (
    <div className="min-h-screen overflow-hidden">
      <Navbar />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-28 sm:px-8 lg:px-12">
        <div className="mb-8">
          <p className="mb-1 text-xs text-opus-muted">{admin ? 'Opus Admin' : 'لوحة العميل'}</p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-3xl font-extrabold text-opus-text">{title}</h1>
            <span className="rounded-md border border-opus-border/40 px-3 py-1 text-xs text-opus-muted">
              {admin ? 'مقيد بالصلاحية' : 'وصول خاص'}
            </span>
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-[200px_1fr]">
          <aside className="h-fit rounded-xl border border-opus-border/40 bg-opus-card/20 p-3">
            <nav className="grid gap-1 text-sm">
              {links.map(([label, href]) => (
                <Link key={href} href={href} className="rounded-lg px-3 py-2.5 text-opus-muted transition hover:bg-opus-card hover:text-opus-text">{label}</Link>
              ))}
            </nav>
          </aside>
          <Card>{children}</Card>
        </div>
      </main>
    </div>
  );
}
