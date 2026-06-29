import { Navbar } from './ui';

export function DashboardShell({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  children: React.ReactNode;
  /** kept for backwards-compat with legacy /admin pages; no longer changes layout */
  admin?: boolean;
}) {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main dir="rtl" className="mx-auto w-full max-w-6xl px-4 pb-20 pt-28 sm:px-8 lg:px-12">
        <header className="mb-8 border-b border-opus-border pb-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-arabic text-3xl font-extrabold tracking-tight text-opus-text">{title}</h1>
              {subtitle ? <p className="mt-2 font-arabic text-sm text-opus-muted">{subtitle}</p> : null}
            </div>
            {badge ? (
              <span className="rounded-full border border-opus-border bg-opus-surface px-3 py-1 font-arabic text-xs font-bold text-opus-muted">
                {badge}
              </span>
            ) : null}
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
