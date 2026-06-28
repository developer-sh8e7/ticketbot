import { CommandExplorer } from '@/components/CommandExplorer';
import { PublicFrame, SectionTitle } from '@/components/ui';

export default function CommandsPage() {
  return (
    <PublicFrame>
      <SectionTitle eyebrow="Commands" title="أوامر البوتات" description="ابحث أو اختر تصنيفًا لمراجعة أوامر البوت." />
      <div className="mb-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 text-sm leading-7 text-[var(--color-muted)]">
        <span className="font-bold text-[var(--color-text)]">ملاحظة:</span>{' '}
        الأوامر المعروضة غير كاملة حاليًا <span className="text-[var(--color-accent-2)]">(في أشياء بتجي زيادة قريبًا)</span>.
      </div>
      <CommandExplorer />
      <p className="mt-10 text-center text-xs text-opus-muted">
        Commands are registered per server and per bot instance. Opus does not use global commands for customer bots.
      </p>
    </PublicFrame>
  );
}
