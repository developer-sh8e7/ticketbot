import { DashboardShell } from '@/components/DashboardShell';

export default function BotSettingsPage() {
  return (
    <DashboardShell title="Bot identity">
      <div className="grid gap-4">
        {['Bot name', 'Avatar URL', 'Description'].map((field) => <div key={field} className="rounded-2xl border border-opus-border bg-opus-panel p-4"><p className="mb-2 text-sm text-opus-muted">{field}</p><div className="input text-opus-muted">Managed through secure API</div></div>)}
        <p className="text-sm text-opus-muted">Status/presence غير قابل للتعديل من الواجهة.</p>
      </div>
    </DashboardShell>
  );
}
