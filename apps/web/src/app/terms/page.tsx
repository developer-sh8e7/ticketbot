import type { Metadata } from 'next';
import { PublicFrame } from '@/components/ui';

export const metadata: Metadata = { title: 'Terms of Service' };

const DiscordLink = () => (
  <a href="https://discord.gg/ahGvNTKyuv" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2 hover:text-opus-text">
    https://discord.gg/ahGvNTKyuv
  </a>
);

export default function TermsPage() {
  return (
    <PublicFrame>
      <article className="mx-auto max-w-3xl text-base leading-8 text-opus-muted">
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-opus-text">Terms of Service</h1>
        <p className="mb-8 text-sm">Last updated: June 2025</p>

        <Section title="1. Service Description">
          <p>Opus Solutions provides digital Discord bot services, including ticket management bots, SystemBot, HumanGuard AI, custom bot development, and related digital automation tools (collectively, the &ldquo;Services&rdquo;). All Services are digital in nature and are delivered electronically. There is no physical shipment, installation, or on-site visit associated with any Opus Solutions product.</p>
          <p>The specific features, limitations, and pricing of each product are described on the Pricing page and may be updated from time to time. By purchasing a Service, you acknowledge that you have read and understood the product description before completing your order.</p>
        </Section>

        <Section title="2. User Responsibilities">
          <p>You are solely responsible for:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Providing accurate and complete information during the purchase and activation process, including your Discord server ID, guild ID, and any other configuration details required.</li>
            <li>Maintaining the confidentiality and security of your Discord account, activation codes, and any credentials associated with your account.</li>
            <li>Ensuring that your use of the Services complies with Discord&rsquo;s Terms of Service and Community Guidelines, as well as all applicable local, national, and international laws.</li>
            <li>Using the Services in a manner that does not infringe the rights of others, including privacy, intellectual property, and data protection rights.</li>
          </ul>
          <p>Opus Solutions is not liable for any loss, damage, or service interruption caused by inaccurate or incomplete information provided by you. Once the Services are configured and linked to your server, they are deemed delivered and fully performed.</p>
        </Section>

        <Section title="3. Activation & Access">
          <p>Upon purchase, you will receive a product-specific activation code (e.g., OPUS-TICKET-XXXX-XXXX). This code must be entered on the Login page and linked to your Discord account via Discord OAuth to activate the Services.</p>
          <p>Activation codes are:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Single-use and tied to one Discord account once claimed.</li>
            <li>Non-transferable after being linked to a Discord account.</li>
            <li>Considered fully delivered once the activation code is generated and made available to you.</li>
          </ul>
          <p>If an activation code is lost before being linked to a Discord account, please contact us on Discord for assistance. Opus Solutions reserves the right to revoke any activation code that is used in violation of these Terms, including but not limited to fraud, chargeback abuse, or unauthorized resale.</p>
        </Section>

        <Section title="4. Subscription & Billing">
          <p>Payments for Services are processed through third-party payment providers. Opus Solutions does not store, process, or have access to full card numbers, CVV codes, or bank account details. Subscription plans are billed on a recurring monthly basis as specified on the Pricing page.</p>
          <p><strong>Key billing terms:</strong></p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Subscriptions are prepaid for each billing period.</li>
            <li>Services are activated immediately upon payment confirmation.</li>
            <li>Subscriptions expire automatically at the end of each billing period. There is no automatic renewal unless you explicitly authorize it. You must manually renew your subscription before the expiry date to maintain continuous access.</li>
            <li>Failure to pay for a renewal will result in automatic suspension or termination of the Services at the end of the current billing period, without exception.</li>
          </ul>
        </Section>

        <Section title="5. No Refund Policy">
          <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-5 text-sm">
            <p className="font-bold text-red-300">No Refunds — Read Carefully</p>
            <p className="mt-2">All purchases of Opus Solutions Services are <strong>final and non-refundable</strong>. By completing a purchase, you expressly acknowledge and agree that Opus Solutions does not offer refunds, credits, or exchanges for any reason, including but not limited to:</p>
            <ul className="mt-2 list-inside list-disc space-y-1">
              <li>Change of mind or buyer&rsquo;s remorse.</li>
              <li>Incorrect server, guild, or configuration information provided by you.</li>
              <li>Failure to use or activate the Services after purchase.</li>
              <li>Discord platform outages, bans, permission issues, or policy changes.</li>
              <li>Features not meeting expectations, unless materially different from the description on the Pricing page.</li>
              <li>Any other reason not specifically covered by mandatory consumer protection laws that cannot be contractually waived.</li>
            </ul>
          </div>
          <p className="mt-3">All Services are digital goods delivered electronically. Once the activation code is generated or the Service is linked to your Discord server, it is considered fully performed and delivered. This No Refund Policy applies to all products and services offered by Opus Solutions, including but not limited to Bot Ticket, SystemBot, HumanGuard AI, and Custom Bot development.</p>
          <p>If a refund is required by applicable law that cannot be waived, Opus Solutions will comply with the legal requirement. This policy does not affect any statutory rights you may hold under applicable consumer protection regulations in your jurisdiction.</p>
        </Section>

        <Section title="6. Digital Delivery & Performance">
          <p>All Opus Solutions products are delivered digitally. Delivery is deemed complete at the earliest of the following events:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>The activation code is generated and displayed to you after purchase.</li>
            <li>The Service is linked to your Discord server.</li>
            <li>The activation code is linked to your Discord account.</li>
          </ul>
          <p>Because the Services are digital and fully automated, no physical goods are shipped, and no on-site installation or setup is provided unless explicitly stated in a separate written agreement (e.g., a Custom Bot development contract).</p>
        </Section>

        <Section title="7. Termination">
          <p>Opus Solutions reserves the right to suspend, terminate, or restrict access to the Services at any time, without prior notice, if:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>You violate any term of these Terms of Service.</li>
            <li>You engage in fraud, chargeback abuse, or unauthorized resale.</li>
            <li>You use the Services for any illegal activity or in violation of Discord&rsquo;s Terms of Service.</li>
            <li>You harass, threaten, or abuse Opus Solutions staff or other customers.</li>
          </ul>
          <p>You may cancel your subscription at any time through your customer dashboard. Cancellation stops future billing but does not entitle you to a refund for the current paid period. Service continues until the end of the current billing cycle.</p>
          <p>Upon termination for any reason, your activation code will be revoked, and access to the Services will be permanently disabled. Opus Solutions reserves the right to pursue legal remedies for any losses caused by your breach of these Terms.</p>
        </Section>

        <Section title="8. Limitation of Liability">
          <p>To the maximum extent permitted by applicable law, Opus Solutions, its owners, employees, and affiliates shall not be liable for any:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Indirect, incidental, special, consequential, or punitive damages.</li>
            <li>Loss of profits, revenue, data, or business opportunity.</li>
            <li>Service interruption, downtime, or data loss caused by third-party services (including Discord, Supabase, Railway, or payment processors).</li>
            <li>Damages arising from your failure to maintain accurate account or server information.</li>
          </ul>
          <p>Our total liability to you for any claim arising from or related to the Services shall not exceed the total amount you have paid to Opus Solutions in the twelve (12) months preceding the claim. This limitation applies regardless of the legal theory under which the claim is made.</p>
        </Section>

        <Section title="9. Changes to Terms">
          <p>Opus Solutions reserves the right to update or modify these Terms of Service at any time. Material changes will be communicated through the website or via our Discord server. Your continued use of the Services after any changes take effect constitutes your acceptance of the updated Terms. If you do not agree with a change, you must stop using the Services and cancel your subscription before the change takes effect.</p>
        </Section>

        <Section title="10. Contact">
          <p>If you have any questions about these Terms of Service, please contact us on Discord: <DiscordLink /></p>
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
