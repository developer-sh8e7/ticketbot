import { DashboardShell } from '@/components/DashboardShell';

const settings = ['Panel channel', 'Log channel', 'Transcript channel', 'Ticket category', 'Archive category', 'Support role', 'Panel message', 'Embed color'];

export default function TicketSettingsPage() {
  return (
    <DashboardShell title="Ticket settings">
      <div className="grid gap-3 md:grid-cols-2">
        {settings.map((setting) => <div key={setting} className="rounded-2xl border border-opus-border bg-opus-panel p-4"><p className="text-sm text-opus-muted">{setting}</p><b className="mt-2 block">Ready</b></div>)}
      </div>
    </DashboardShell>
  );
}
