import { DashboardShell } from '@/components/DashboardShell';

const cards = ['Orders', 'Activation codes', 'Client bots', 'Website events'];

export default function AdminPage() {
  return <DashboardShell admin title="Admin overview"><div className="grid gap-3 md:grid-cols-2">{cards.map((card) => <div key={card} className="rounded-2xl border border-opus-border bg-opus-panel p-4"><b>{card}</b><p className="mt-2 text-sm text-opus-muted">Protected admin API</p></div>)}</div></DashboardShell>;
}
