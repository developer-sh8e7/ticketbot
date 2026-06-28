import { DashboardShell } from '@/components/DashboardShell';
export default function AdminOrdersPage() { return <DashboardShell admin title="Payment orders"><div className="rounded-2xl border border-opus-border bg-opus-panel p-5 text-opus-muted">Order table loads through <code dir="ltr">/api/admin/orders</code> for authorized admins.</div></DashboardShell>; }
