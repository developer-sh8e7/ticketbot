import type { Metadata } from 'next';
import { PublicFrame } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacy Policy' };

const DiscordLink = () => (
  <a href="https://discord.gg/WRL" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2 hover:text-opus-text">
    https://discord.gg/WRL
  </a>
);

export default function PrivacyPage() {
  return (
    <PublicFrame>
      <article className="mx-auto max-w-3xl text-base leading-8 text-opus-muted">
        <h1 className="mb-6 text-4xl font-extrabold tracking-tight text-opus-text">Privacy Policy</h1>
        <p className="mb-8 text-sm">Last updated: June 2025</p>

        <Section title="1. Data We Collect">
          <p>Opus Solutions collects only the information necessary to provide, secure, and improve the Services. We collect the following categories of data:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong>Discord Account Data:</strong> Discord user ID, username, avatar URL, and any other data made available through Discord OAuth during the authentication process.</li>
            <li><strong>Guild Data:</strong> Discord server (guild) ID and server name associated with the Service you have activated.</li>
            <li><strong>Purchase Data:</strong> Order ID, invoice ID, product ID, product name, and transaction amount from our payment processor. We do not receive or store full payment card details.</li>
            <li><strong>Service Data:</strong> Activation codes (stored encrypted), subscription status, plan type, product type, service expiry dates, and configuration settings.</li>
            <li><strong>Communication Data:</strong> If you contact us through Discord or email, we may retain a record of that communication for support and quality assurance purposes.</li>
          </ul>
        </Section>

        <Section title="2. How We Use Data">
          <p>Your data is used exclusively for the following purposes:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>To create, manage, and deliver the Services you have purchased.</li>
            <li>To link activation codes to your Discord account via OAuth.</li>
            <li>To provide customer support and respond to your inquiries.</li>
            <li>To send important service-related notifications, including subscription expiry reminders and service updates.</li>
            <li>To detect and prevent fraud, abuse, and unauthorized use of the Services.</li>
            <li>To improve the quality and reliability of the Services through aggregated, anonymized analytics.</li>
          </ul>
          <p>We do not sell, rent, or share your personal data with third parties for their own marketing purposes. We do not use your data for advertising, profiling, or automated decision-making that affects your legal rights.</p>
        </Section>

        <Section title="3. Discord OAuth">
          <p>Opus Solutions uses Discord OAuth 2.0 to authenticate users and link activation codes to Discord accounts. When you authenticate via Discord, we receive:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Your Discord user ID (a unique numeric identifier).</li>
            <li>Your Discord username and avatar URL.</li>
          </ul>
          <p>This data is used solely to identify your account, display your information in the dashboard, and associate your activated Services with your Discord identity. We request only the <code>identify</code> scope from Discord OAuth. We do not request access to your email, guild list, or any other Discord data unless explicitly required for a specific Service feature, in which case you will be informed at the time of authorization.</p>
          <p>Discord OAuth tokens are stored temporarily and securely for the duration of your session. You can revoke Opus Solutions&rsquo; access at any time through your Discord Authorized Apps settings.</p>
        </Section>

        <Section title="4. Data Retention">
          <p>We retain your personal data for as long as your account is active or as long as needed to provide the Services. Specifically:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Account and service data is retained for the duration of your subscription plus ninety (90) days after termination or expiry.</li>
            <li>Aggregated, anonymized analytics data may be retained indefinitely for business intelligence purposes.</li>
            <li>Data that we are legally required to retain (e.g., for tax or compliance purposes) will be kept for the period required by applicable law.</li>
          </ul>
          <p>After the retention period ends, your data is permanently deleted from our systems. You may request earlier deletion by contacting us on Discord, subject to legal retention requirements.</p>
        </Section>

        <Section title="5. Cookies">
          <p>Opus Solutions uses only strictly necessary cookies for the operation of the Services. These include:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong>Session cookies:</strong> To maintain your authenticated session.</li>
            <li><strong>CSRF cookies:</strong> To protect against cross-site request forgery attacks.</li>
          </ul>
          <p>We do not use advertising cookies, tracking cookies, analytics cookies, or any third-party cookies for marketing purposes. You can control cookie settings through your browser, but disabling necessary cookies may prevent the Services from functioning correctly.</p>
        </Section>

        <Section title="6. Third-Party Services">
          <p>Opus Solutions relies on the following third-party services to operate. Each service has its own privacy policy and data processing terms, which we encourage you to review:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong>Discord</strong> — OAuth authentication and bot hosting. <a href="https://discord.com/privacy" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2">Privacy Policy</a></li>
            <li><strong>PayPal</strong> — Payment processing. <a href="https://www.paypal.com/privacy" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2">Privacy Policy</a></li>
            <li><strong>Supabase</strong> — Database and storage. <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2">Privacy Policy</a></li>
            <li><strong>Railway</strong> — Application hosting. <a href="https://railway.app/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-opus-accent underline underline-offset-2">Privacy Policy</a></li>
          </ul>
          <p className="mt-2">Each third party processes data in accordance with its own terms and applicable data protection laws. Opus Solutions ensures contractual safeguards are in place with each processor where required by applicable law.</p>
        </Section>

        <Section title="7. Your Rights">
          <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li><strong>Right to Access:</strong> Request a copy of the personal data we hold about you.</li>
            <li><strong>Right to Rectification:</strong> Request correction of inaccurate or incomplete data.</li>
            <li><strong>Right to Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements.</li>
            <li><strong>Right to Data Portability:</strong> Request a machine-readable copy of your data.</li>
            <li><strong>Right to Object:</strong> Object to the processing of your data for certain purposes.</li>
          </ul>
          <p>To exercise any of these rights, please contact us on Discord. We will respond to your request within the timeframe required by applicable law (typically 30 days). We may need to verify your identity before processing your request.</p>
        </Section>

        <Section title="8. Data Security">
          <p>Opus Solutions implements reasonable technical and organizational measures to protect your data, including:</p>
          <ul className="list-inside list-disc space-y-1.5">
            <li>Encryption of sensitive fields at rest using AES-256-GCM.</li>
            <li>All traffic served over HTTPS/TLS.</li>
            <li>Strict access controls to encrypted data, limited to authorized automated systems.</li>
            <li>Hashing of sensitive identifiers (activation codes, email addresses) for lookup without exposing plaintext values.</li>
          </ul>
          <p>While we take these precautions seriously, no online service can guarantee absolute security. You use the Services at your own risk. We encourage you to use strong, unique passwords and enable two-factor authentication on your Discord account.</p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>We may update this Privacy Policy when necessary to reflect changes in our practices, legal requirements, or the Services. Changes will be reflected in the &ldquo;Last updated&rdquo; date at the top of this page. Material changes may be communicated through our Discord server. We encourage you to review this policy periodically.</p>
        </Section>

        <Section title="10. Contact">
          <p>If you have any questions, concerns, or requests regarding this Privacy Policy or your personal data, please contact us on Discord: <DiscordLink /></p>
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
