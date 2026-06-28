import { DashboardShell } from '@/components/DashboardShell';

const items = ['Linked Discord account', 'Current session', 'Dashboard access', 'Recent activity'];

export default function SecurityPage() {
  return (
    <DashboardShell title="Access and security">
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((item) => <div key={item} className="rounded-2xl border border-opus-border bg-opus-panel p-4"><b>{item}</b><p className="mt-2 text-sm text-opus-muted">Available after account connection</p></div>)}
      </div>
    </DashboardShell>
  );
}
