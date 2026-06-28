import { DashboardShell } from '@/components/DashboardShell';
import { products } from '@/lib/site-content';

const rows = ['Plan type', 'Billing period', 'Status', 'Started at', 'Renewal / Expires', 'Order ID', 'Product'];

function paypalRenewHref() {
  const ticket = products().find((product) => product.key === 'ticket');
  return ticket && ticket.price_monthly > 0 ? `https://paypal.me/AAlamri381/${ticket.price_monthly.toFixed(2)}` : '/pricing';
}

export default function BillingPage() {
  const renewHref = paypalRenewHref();
  return (
    <DashboardShell title="Billing">
      <div className="grid gap-5">
        <div className="grid gap-3 md:grid-cols-2">{rows.map((row) => <div key={row} className="rounded-2xl border border-opus-border bg-opus-panel p-4"><p className="text-sm text-opus-muted">{row}</p><b className="mt-2 block">—</b></div>)}</div>
        <a className="inline-flex w-fit rounded-2xl border border-opus-silver bg-opus-text px-5 py-3 font-semibold text-black" href={renewHref} target="_blank" rel="noopener noreferrer">Renew</a>
      </div>
    </DashboardShell>
  );
}
