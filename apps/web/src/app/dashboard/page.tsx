import { DashboardShell } from '@/components/DashboardShell';
import { StatusDot } from '@/components/ui';
import { getSession } from '@/lib/sessions';
import { getOwnedBots } from '@/lib/dashboard-data';

export const dynamic = 'force-dynamic';

type OwnedBot = Awaited<ReturnType<typeof getOwnedBots>>[number];
type BillingPeriod = 'monthly' | 'quarterly';

function addMonths(date: Date, months: number) {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
}

function inferBillingPeriod(bot: OwnedBot): BillingPeriod {
  const plan = String(bot.plan_type || '').toLowerCase();
  return plan.includes('quarter') || plan.includes('3') ? 'quarterly' : 'monthly';
}

function periodLabel(period: BillingPeriod) {
  return period === 'quarterly' ? '3 شهور' : 'شهري';
}

function formatDate(value: string | Date | null | undefined) {
  return value ? new Date(value).toLocaleDateString('en-CA') : '—';
}

function expiryForPeriod(bot: OwnedBot) {
  if (bot.expires_at) return new Date(bot.expires_at);
  const period = inferBillingPeriod(bot);
  const start = bot.last_started_at || bot.updated_at;
  if (!start) return null;
  return addMonths(new Date(start), period === 'quarterly' ? 3 : 1);
}

function planDisplay(bot: OwnedBot) {
  const label = periodLabel(inferBillingPeriod(bot));
  const plan = bot.plan_type || bot.product_type || '—';
  return plan === '—' ? label : `${plan} — ${label}`;
}

export default async function DashboardPage() {
  const session = await getSession();
  
  let bots: Awaited<ReturnType<typeof getOwnedBots>> = [];
  if (session) {
    bots = await getOwnedBots(session.discordUserId);
  }

  return (
    <DashboardShell title="Overview">
      <div className="grid gap-4">
        {!session ? (
          <p className="text-opus-muted">سجّل الدخول بكود التفعيل لعرض بيانات بوتك.</p>
        ) : bots.length === 0 ? (
          <p className="text-opus-muted">لا يوجد بوتات مرتبطة بحسابك بعد. اشترك أولاً لتفعيل بوت.</p>
        ) : (
          <div className="grid gap-4">
            {bots.map((bot) => {
              const expiry = expiryForPeriod(bot);
              return (
                <div key={bot.id} className="rounded-2xl border border-opus-border bg-opus-panel p-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                    <div>
                      <p className="text-xs text-opus-muted">Bot name</p>
                      <p className="mt-1 font-semibold text-opus-text">{bot.bot_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-opus-muted">Product</p>
                      <p className="mt-1 font-semibold text-opus-text">{bot.product_type || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-opus-muted">Status</p>
                      <p className="mt-1 font-semibold text-opus-text"><StatusDot status={bot.status || 'inactive'} /></p>
                    </div>
                    <div>
                      <p className="text-xs text-opus-muted">Plan</p>
                      <p className="mt-1 font-semibold text-opus-text">{planDisplay(bot)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-opus-muted">Renewal / Expires</p>
                      <p className="mt-1 font-semibold text-opus-text">{formatDate(expiry)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-opus-muted">Guild ID</p>
                      <p className="mt-1 font-semibold text-opus-text">{bot.guild_id || '—'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </DashboardShell>
  );
}
