import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flower2, Mail, ShieldCheck } from "lucide-react";
import "../legal.css";

export const metadata: Metadata = {
  title: "Terms · Thoughtfully AI",
  description: "The terms for using Thoughtfully AI: accounts, workspaces, the free trial, subscriptions, consent-based verification and account deletion.",
};

const contactEmail = process.env.SECURITY_ALERT_EMAIL?.trim() || "mail2shankarjun@gmail.com";

export default function TermsPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link href="/" className="legal-logo" aria-label="Thoughtfully home">
          <span className="legal-logo-mark"><Flower2 size={17} /></span>
          <span>thoughtfully<span className="legal-logo-badge">AI</span></span>
        </Link>
        <nav className="legal-header-links" aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <article className="legal-doc">
        <p className="legal-eyebrow">TERMS OF USE</p>
        <h1>A calm agreement for a calm planner.</h1>
        <p className="legal-updated">Last updated: 22 October 2026</p>
        <p className="legal-lede">
          These terms describe how Thoughtfully AI works today. By creating an account or using the planner,
          you agree to them. The service is an early-access product, so features may change as it improves.
        </p>

        <nav className="legal-toc" aria-label="On this page">
          <a href="#service">The service</a>
          <a href="#accounts">Accounts &amp; workspaces</a>
          <a href="#pricing">Trial &amp; pricing</a>
          <a href="#use">Acceptable use</a>
          <a href="#verification">Device verification</a>
          <a href="#data">Data &amp; deletion</a>
          <a href="#contact">Contact</a>
        </nav>

        <section id="service">
          <h2>1. The service</h2>
          <p>
            Thoughtfully is a planning workspace for occasions, shopping lists, budgets, calendars and
            reminders. It includes optional AI-assisted list review and checklist generation. AI output is a
            suggestion: check quantities, prices, customs and safety details before you rely on them.
          </p>
          <p>
            The planner is provided as an early-access service. We aim to keep it available and accurate, but we
            cannot promise uninterrupted availability or that every suggestion fits your occasion.
          </p>
        </section>

        <section id="accounts">
          <h2>2. Accounts and workspaces</h2>
          <p>
            You need an account to use the planner. Keep your sign-in details private and tell us promptly if you
            believe someone else has access. Each workspace is separate: only its members should be able to see
            its lists and plans.
          </p>
          <p>
            Invite only people you trust to a workspace. If you are the workspace owner, you are responsible for
            who you invite and for the security contact configured for verification alerts.
          </p>
        </section>

        <section id="pricing">
          <h2>3. Free trial and pricing</h2>
          <p>
            New accounts start with a <strong>7-day free trial</strong>. If you choose to continue, the annual
            plan is <strong>₹200 per year</strong>. The amount, currency and renewal date are shown at checkout
            before you pay.
          </p>
          <p>
            Payments are processed by the payment provider used at checkout. We receive subscription status, not
            your full card details. If you cancel, access continues to the end of the current paid period unless
            the checkout flow says otherwise.
          </p>
        </section>

        <section id="use">
          <h2>4. Acceptable use</h2>
          <ul>
            <li>Do not use the service to capture or share someone else&apos;s image without their knowledge and consent.</li>
            <li>Do not attempt to bypass workspace access controls, device verification or authentication.</li>
            <li>Do not upload unlawful, harmful or infringing content, or use the AI features to generate it.</li>
            <li>Do not probe, overload or disrupt the service or other people&apos;s workspaces.</li>
          </ul>
          <p>
            We may suspend or end access where these rules are broken or where required to protect the service
            and its users.
          </p>
        </section>

        <section id="verification">
          <h2>5. Consent-based device verification</h2>
          <p>
            The planner can ask you to verify a new device. A photo is captured only after you read the notice,
            tick the consent box and press <strong>Turn on camera</strong>. No audio is recorded. The photo, IP
            address, browser details and approximate location are shared with the workspace administrator for
            safety review, and retained for up to 30 days.
          </p>
          <p>
            Where the workspace operator has made verification mandatory, you must complete it to keep using the
            planner, or sign out instead. If you cannot use a camera, contact the administrator for an alternative
            check. You can review and delete verification history from <Link href="/security">/security</Link>.
          </p>
        </section>

        <section id="data">
          <h2>6. Privacy, export and deletion</h2>
          <p>
            Our <Link href="/privacy">privacy notice</Link> explains the data we handle and why. You can download
            a JSON export of your account data from the <Link href="/account">account page</Link>. The same page
            lets you permanently delete your account, including verification photos and related rows.
          </p>
          <p>
            Deleting your account cannot be undone. You are responsible for keeping your own copy of anything you
            want to retain before deleting.
          </p>
        </section>

        <section id="changes">
          <h2>7. Changes to these terms</h2>
          <p>
            As the early-access product changes, these terms may be updated. The date at the top of this page shows
            the current version. Continuing to use the planner after an update means you accept the updated terms.
          </p>
        </section>

        <section id="contact">
          <h2>8. Contact</h2>
          <p>
            For questions about these terms, billing or account deletion, email
            {" "}<a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
          <p className="legal-note">
            <ShieldCheck size={14} /> Thoughtfully is built to be consent-first: no background camera access, no
            covert recording and no selling of personal data.
          </p>
        </section>

        <footer className="legal-footer">
          <Link href="/"><ArrowLeft size={13} /> Back to Thoughtfully</Link>
          <Link href="/privacy">Read the privacy notice</Link>
          <a href={`mailto:${contactEmail}`}><Mail size={13} /> {contactEmail}</a>
        </footer>
      </article>
    </main>
  );
}
