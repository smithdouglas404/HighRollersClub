import { DashboardLayout } from "@/components/DashboardLayout";
import { ShieldCheck } from "lucide-react";

const LAST_UPDATED = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

interface SectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-3">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-sm font-mono text-emerald-400">
          {number}
        </span>
        {title}
      </h2>
      <div className="text-sm text-gray-400 leading-relaxed space-y-3 pl-11">
        {children}
      </div>
    </section>
  );
}

export default function Privacy() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black text-white">Privacy Policy</h1>
              <p className="text-xs text-gray-500 mt-0.5">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            High Rollers Club ("we", "our", or "us") respects your privacy and is committed to protecting your
            personal data. This Privacy Policy explains how we collect, use, store, and share information when you
            use our platform and services.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
          <Section number={1} title="Information We Collect">
            <p>We collect the following categories of information:</p>

            <h3 className="text-white font-semibold mt-4 mb-1">Account Data</h3>
            <p>
              When you create an account, we collect your username, email address, and password (stored as a
              salted hash). If you choose to provide it, we may also collect your display name, avatar image,
              and profile preferences.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Gameplay Data</h3>
            <p>
              We record hand histories, game actions, chip transactions, tournament results, and statistical
              data related to your play. This data is used to provide features such as hand replay, analytics,
              leaderboards, and provably fair verification.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Device and Technical Information</h3>
            <p>
              We automatically collect device type, operating system, browser type and version, IP address,
              session duration, page views, and general usage patterns. This information helps us optimize
              performance and detect fraudulent activity.
            </p>

            <h3 className="text-white font-semibold mt-4 mb-1">Communications</h3>
            <p>
              If you contact our support team, participate in surveys, or use in-game chat features, we may
              retain the content of those communications for quality assurance and dispute resolution.
            </p>
          </Section>

          <Section number={2} title="How We Use Information">
            <p>We use collected information for the following purposes:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Provide, maintain, and improve the Service</li>
              <li>Authenticate users and secure accounts</li>
              <li>Process transactions and manage virtual currency</li>
              <li>Deliver hand histories, analytics, and leaderboard features</li>
              <li>Ensure fair play and detect collusion, multi-accounting, or abuse</li>
              <li>Send service-related notifications (account security, policy changes)</li>
              <li>Respond to support requests and resolve disputes</li>
              <li>Analyze usage trends to improve user experience</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p>
              We do not sell your personal information to third parties. We do not use your data for
              third-party advertising purposes.
            </p>
          </Section>

          <Section number={3} title="Data Retention">
            <p>
              We retain your personal data for as long as your account is active or as needed to provide
              the Service. Gameplay data (hand histories, statistics) may be retained indefinitely for
              provably fair verification and platform integrity.
            </p>
            <p>
              If you request account deletion, we will remove your personal data within 30 days, except
              where retention is required by law or for legitimate business purposes such as fraud prevention.
              Anonymized and aggregated data may be retained for analytics.
            </p>
          </Section>

          <Section number={4} title="Cookies and Local Storage">
            <p>
              We use cookies and browser local storage for the following purposes:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong className="text-gray-300">Essential cookies:</strong> Required for authentication, session management, and security</li>
              <li><strong className="text-gray-300">Preference cookies:</strong> Store your display settings, theme preferences, and table customizations</li>
              <li><strong className="text-gray-300">Analytics cookies:</strong> Help us understand how users interact with the platform to improve features</li>
            </ul>
            <p>
              You can control cookie settings through your browser. Disabling essential cookies may prevent
              you from using certain features of the Service.
            </p>
          </Section>

          <Section number={5} title="Third-Party Services">
            <p>
              We may use third-party services for hosting, analytics, payment processing, and error monitoring.
              These services may have access to limited personal data necessary for their function. Our
              third-party partners are contractually obligated to protect your data and use it only for the
              purposes we specify.
            </p>
            <p>
              We do not share your gameplay data, hand histories, or strategic information with third parties.
              The Service may contain links to external websites; we are not responsible for the privacy practices
              of those sites.
            </p>
          </Section>

          <Section number={6} title="Your Rights">
            <p>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
            <ul className="list-disc list-inside space-y-1.5">
              <li><strong className="text-gray-300">Access:</strong> Request a copy of the personal data we hold about you</li>
              <li><strong className="text-gray-300">Correction:</strong> Request that we correct inaccurate or incomplete data</li>
              <li><strong className="text-gray-300">Deletion:</strong> Request deletion of your personal data, subject to legal retention requirements</li>
              <li><strong className="text-gray-300">Portability:</strong> Request your data in a structured, machine-readable format</li>
              <li><strong className="text-gray-300">Objection:</strong> Object to certain types of data processing</li>
              <li><strong className="text-gray-300">Withdrawal of consent:</strong> Withdraw consent where processing is based on consent</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us through our support page. We will respond to
              valid requests within 30 days.
            </p>
          </Section>

          <Section number={7} title="Security">
            <p>
              We implement industry-standard security measures to protect your data, including encrypted
              connections (TLS/SSL), salted password hashing, session management controls, and access
              restrictions. All game shuffles use SHA-256 cryptographic verification for provable fairness.
            </p>
            <p>
              While we strive to protect your personal information, no method of transmission over the
              Internet is 100% secure. We cannot guarantee absolute security but are committed to promptly
              addressing any security incidents.
            </p>
          </Section>

          <Section number={8} title="Updates to This Policy">
            <p>
              We may update this Privacy Policy from time to time. When we make material changes, we will
              notify you by email, in-app notification, or by posting a prominent notice on the platform.
              The "Last updated" date at the top of this page indicates when the policy was most recently revised.
            </p>
            <p>
              Your continued use of the Service after changes are posted constitutes acceptance of the
              updated Privacy Policy.
            </p>
          </Section>

          <Section number={9} title="Contact Us">
            <p>
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices,
              please reach out through our <a href="/support" className="text-primary hover:underline">support page</a>.
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center text-xs text-gray-600">
          This policy applies to all users of the High Rollers Club platform worldwide.
        </div>
      </div>
    </DashboardLayout>
  );
}
