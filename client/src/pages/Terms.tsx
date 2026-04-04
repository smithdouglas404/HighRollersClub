import { DashboardLayout } from "@/components/DashboardLayout";
import { ScrollText } from "lucide-react";

const LAST_UPDATED = "April 1, 2026";

interface SectionProps {
  number: number;
  title: string;
  children: React.ReactNode;
}

function Section({ number, title, children }: SectionProps) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-3">
        <span className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-sm font-mono text-primary">
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

export default function Terms() {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <ScrollText className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-black text-white">Terms of Service</h1>
              <p className="text-xs text-gray-500 mt-0.5">Last updated: {LAST_UPDATED}</p>
            </div>
          </div>
          <p className="text-sm text-gray-400 leading-relaxed">
            Welcome to High Rollers Club. These Terms of Service ("Terms") govern your access to and use of our
            platform, including all associated services, features, and content. By accessing or using High Rollers Club,
            you agree to be bound by these Terms in their entirety.
          </p>
        </div>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 md:p-8">
          <Section number={1} title="Acceptance of Terms">
            <p>
              By creating an account, accessing, or using any part of the High Rollers Club platform ("Service"),
              you acknowledge that you have read, understood, and agree to be bound by these Terms of Service and
              our Privacy Policy. If you do not agree to these Terms, you must not use the Service.
            </p>
            <p>
              We reserve the right to modify these Terms at any time. Continued use of the Service after changes
              are posted constitutes acceptance of the modified Terms. We will make reasonable efforts to notify
              users of material changes via email or in-app notification.
            </p>
          </Section>

          <Section number={2} title="Eligibility">
            <p>
              You must be at least 18 years of age (or the age of legal majority in your jurisdiction, whichever
              is greater) to create an account and use the Service. By registering, you represent and warrant that
              you meet this age requirement.
            </p>
            <p>
              You are responsible for ensuring that your use of the Service complies with all applicable local,
              state, national, and international laws and regulations. The Service is not available in jurisdictions
              where online gaming platforms are prohibited by law.
            </p>
          </Section>

          <Section number={3} title="Account Rules">
            <p>
              You are responsible for maintaining the confidentiality of your account credentials and for all
              activities that occur under your account. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Provide accurate and truthful information during registration</li>
              <li>Maintain only one account per person</li>
              <li>Not share your account credentials with any third party</li>
              <li>Immediately notify us of any unauthorized use of your account</li>
              <li>Not use automated tools, bots, or scripts to interact with the Service</li>
            </ul>
            <p>
              We reserve the right to suspend or terminate accounts that violate these rules without prior notice.
            </p>
          </Section>

          <Section number={4} title="Fair Play Policy">
            <p>
              High Rollers Club is committed to maintaining a fair and enjoyable environment for all players.
              The following activities are strictly prohibited:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Collusion with other players to gain an unfair advantage</li>
              <li>Use of external software, AI assistants, or real-time solver tools during gameplay</li>
              <li>Chip dumping or any form of intentional chip transfer between accounts</li>
              <li>Exploiting bugs, glitches, or vulnerabilities in the platform</li>
              <li>Multi-accounting or using multiple accounts at the same table</li>
              <li>Harassment, threats, or abusive behavior toward other players</li>
            </ul>
            <p>
              Violations of the Fair Play Policy may result in immediate account suspension, forfeiture of chips,
              and permanent ban from the platform. All shuffles are provably fair using SHA-256 cryptographic
              verification, and hand histories are available for audit.
            </p>
          </Section>

          <Section number={5} title="Virtual Currency">
            <p>
              The chips and virtual currency used on High Rollers Club are for entertainment purposes only and
              hold no real-world monetary value. You acknowledge and agree that:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Chips cannot be exchanged for real money, goods, or services</li>
              <li>Chips have no cash value and are not redeemable</li>
              <li>Purchases of virtual currency are final and non-refundable</li>
              <li>We may adjust chip balances, pricing, or availability at our discretion</li>
              <li>Virtual currency may not be transferred between accounts except through official platform mechanisms</li>
            </ul>
            <p>
              High Rollers Club is a social gaming platform and does not constitute gambling. No real money is
              wagered or won through gameplay.
            </p>
          </Section>

          <Section number={6} title="Intellectual Property">
            <p>
              All content, features, and functionality of the Service -- including but not limited to text, graphics,
              logos, icons, images, audio clips, software, and the overall design -- are the exclusive property of
              High Rollers Club and are protected by copyright, trademark, and other intellectual property laws.
            </p>
            <p>
              You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the
              Service for personal, non-commercial purposes. You may not reproduce, distribute, modify, create
              derivative works from, or publicly display any content from the Service without our express written
              consent.
            </p>
          </Section>

          <Section number={7} title="Limitation of Liability">
            <p>
              To the maximum extent permitted by applicable law, High Rollers Club and its affiliates, officers,
              directors, employees, and agents shall not be liable for any indirect, incidental, special,
              consequential, or punitive damages, including but not limited to loss of profits, data, or goodwill,
              arising from or related to your use of the Service.
            </p>
            <p>
              The Service is provided on an "AS IS" and "AS AVAILABLE" basis without warranties of any kind, either
              express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or secure.
              Our total liability for any claim arising from or relating to these Terms shall not exceed the amount
              you paid to us in the twelve (12) months preceding the claim.
            </p>
          </Section>

          <Section number={8} title="Termination">
            <p>
              We reserve the right to suspend or terminate your account and access to the Service at any time, with
              or without cause, and with or without notice. Reasons for termination may include, but are not limited to:
            </p>
            <ul className="list-disc list-inside space-y-1.5">
              <li>Violation of these Terms or the Fair Play Policy</li>
              <li>Fraudulent or illegal activity</li>
              <li>Extended periods of account inactivity</li>
              <li>Requests from law enforcement or government agencies</li>
            </ul>
            <p>
              Upon termination, your right to use the Service will immediately cease. Any virtual currency or
              items in your account will be forfeited. Provisions of these Terms that by their nature should
              survive termination will remain in effect.
            </p>
          </Section>

          <Section number={9} title="Governing Law">
            <p>
              These Terms shall be governed by and construed in accordance with the laws of the State of Delaware,
              United States, without regard to its conflict of law provisions. Any disputes arising from or relating
              to these Terms or the Service shall be resolved exclusively in the state or federal courts located in
              Delaware.
            </p>
            <p>
              If any provision of these Terms is found to be unenforceable or invalid, that provision shall be
              limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in
              full force and effect.
            </p>
          </Section>
        </div>

        <div className="mt-8 text-center text-xs text-gray-600">
          If you have questions about these Terms, please contact us at{" "}
          <a href="/support" className="text-primary hover:underline">our support page</a>.
        </div>
      </div>
    </DashboardLayout>
  );
}
