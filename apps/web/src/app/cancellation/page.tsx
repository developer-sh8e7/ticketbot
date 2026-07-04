import type { Metadata } from 'next';
import { PublicFrame } from '@/components/ui';

export const metadata: Metadata = { title: 'Cancellation Policy' };

const DiscordLink = () => (
  <a href="https://discord.gg/ahGvNTKyuv" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2 hover:text-opus-text">
    https://discord.gg/ahGvNTKyuv
  </a>
);

export default function CancellationPage() {
  return (
    <PublicFrame>
      <article className="mx-auto max-w-3xl text-base leading-8 text-opus-muted">
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-opus-text">Cancellation Policy</h1>
        <p className="mb-8 text-sm">Last updated: June 2025</p>

        {/* ── STRONG No Refund Notice ── */}
        <div className="mb-8 rounded-3xl border border-red-500/20 bg-red-500/5 p-6 text-sm">
          <p className="text-base font-bold text-red-300">No Refund Policy — Read Carefully</p>
          <div className="mt-4 space-y-3 leading-7">
            <p><strong>Opus Solutions does not offer refunds under any circumstances, for any reason, for any digital product or service.</strong> All sales are final.</p>
            <p>By purchasing any Opus Solutions product or service, you expressly acknowledge and agree that:</p>
            <ul className="list-inside list-disc space-y-1.5">
              <li>All Services are digital and delivered electronically.</li>
              <li>Once an activation code is generated and made available to you, the Service is considered fully delivered and performed.</li>
              <li>Once the Service is linked to your Discord server, delivery is final and irrevocable.</li>
              <li>No refunds will be issued for change of mind, buyer&rsquo;s remorse, incorrect configuration, failure to use, or any other reason.</li>
              <li>No refunds will be issued for Discord platform limitations, server bans, permission issues, or any third-party service outages.</li>
              <li>No refunds, credits, or exchanges will be provided under any circumstances, except where required by applicable law that cannot be contractually waived.</li>
            </ul>
          </div>
        </div>

        <Section title="1. Subscription Cancellation">
          <p>You may cancel your subscription at any time through your customer dashboard. Key terms:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Cancellation stops future billing. You will not be charged for the next billing period.</li>
            <li>Cancellation does not entitle you to a refund for the current paid period. You will continue to have access to the Services until the end of the current billing cycle.</li>
            <li>After the current billing cycle ends, the Services will be automatically suspended or terminated.</li>
            <li>Subscriptions do not auto-renew. You must manually renew before the expiry date to maintain uninterrupted access.</li>
            <li>If you cancel and later wish to resubscribe, you must purchase a new subscription. Previous activation codes, discounts, or pricing are not reinstated.</li>
          </ul>
        </Section>

        <Section title="2. No Refund Policy (Full)">
          <p>This section restates and reinforces the No Refund Policy in explicit detail. Opus Solutions does not offer refunds, credits, chargebacks, or exchanges for any reason, including but not limited to:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong>Change of mind</strong> — You decided you no longer want or need the Service.</li>
            <li><strong>Incorrect purchase</strong> — You bought the wrong product or plan.</li>
            <li><strong>Configuration errors</strong> — You provided incorrect server, guild, or Discord information.</li>
            <li><strong>Non-use</strong> — You did not use or activate the Service after purchase.</li>
            <li><strong>Feature dissatisfaction</strong> — The Service did not meet your expectations, unless it is materially different from the description on the Pricing page at the time of purchase.</li>
            <li><strong>Discord issues</strong> — Server bans, ownership changes, permission errors, rate limits, API changes, or Discord platform outages.</li>
            <li><strong>Third-party issues</strong> — Problems caused by Supabase, Railway, payment processors, or any other third-party service.</li>
            <li><strong>Timeliness</strong> — You did not use the Service within the subscription period.</li>
            <li><strong>Any other reason</strong> — Any cause or circumstance not explicitly covered above but not excluded by applicable law.</li>
          </ul>
          <p className="mt-3">This No Refund Policy applies to all products and services sold by Opus Solutions, including Bot Ticket, SystemBot, HumanGuard AI, Custom Bot development, and any future products or services.</p>
        </Section>

        <Section title="3. Digital Product Disclaimer">
          <p>All products and services provided by Opus Solutions are digital. You acknowledge and agree that:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>There is no physical shipment, delivery, or exchange of tangible goods.</li>
            <li>Services are delivered via activation codes, bot invites, and configuration files transmitted electronically.</li>
            <li>Once the activation code is generated, the Service is deemed fully performed and delivered. This occurs immediately upon purchase completion.</li>
            <li>Once the Service is linked to your Discord server (via bot invite or configuration), delivery is irrevocable.</li>
            <li>Digital goods cannot be &ldquo;returned&rdquo; in the traditional sense. Once access is granted or a code is generated, the transaction is complete.</li>
          </ul>
        </Section>

        <Section title="4. How to Cancel">
          <p>To cancel your subscription:</p>
          <ol className="list-inside list-decimal space-y-1.5">
            <li>Log in to your customer dashboard at <a href="https://opussolutions.xyz/login" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2">https://opussolutions.xyz/login</a>.</li>
            <li>Navigate to the Billing page.</li>
            <li>Click the cancellation link or button next to your active subscription.</li>
            <li>Confirm the cancellation when prompted.</li>
          </ol>
          <p className="mt-2">If you are unable to access your dashboard, contact us on Discord with your order details, and we will process the cancellation on your behalf. Note that cancellations requested via Discord are subject to the same No Refund Policy stated above.</p>
        </Section>

        <Section title="5. Chargeback Policy">
          <p>Filing a chargeback or payment dispute with your bank or payment provider will result in:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Immediate suspension and revocation of your activation code.</li>
            <li>Permanent termination of all Services associated with your account.</li>
            <li>Permanent blacklisting from all Opus Solutions services.</li>
            <li>Referral to collections or legal action for recovery of fees and costs, where permitted by law.</li>
          </ul>
          <p>If you believe a chargeback was filed in error, please contact us on Discord before disputing the charge. We are committed to resolving any legitimate issue directly.</p>
        </Section>

        <Section title="6. Contact">
          <p>For cancellation requests, questions about this policy, or any other inquiries, please contact us on Discord: <DiscordLink /></p>
        </Section>

        <p className="mt-10 border-t border-opus-border pt-6 text-xs text-opus-muted">
          For questions contact us on Discord: <DiscordLink />
        </p>
      </article>
    </PublicFrame>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-2xl font-bold text-opus-text">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
