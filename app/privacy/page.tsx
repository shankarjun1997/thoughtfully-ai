import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Flower2, Mail, ShieldCheck } from "lucide-react";
import "../legal.css";

export const metadata: Metadata = {
  title: "Privacy · Thoughtfully AI",
  description: "How Thoughtfully AI handles accounts, planning data, consent-based device checks and billing information.",
};

const contactEmail = process.env.SECURITY_ALERT_EMAIL?.trim() || "mail2shankarjun@gmail.com";

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <header className="legal-header">
        <Link href="/" className="legal-logo" aria-label="Thoughtfully home">
          <span className="legal-logo-mark"><Flower2 size={17} /></span>
          <span>thoughtfully<span className="legal-logo-badge">AI</span></span>
        </Link>
        <nav className="legal-header-links" aria-label="Legal">
          <Link href="/terms">Terms</Link>
          <Link href="/login">Sign in</Link>
        </nav>
      </header>

      <article className="legal-doc">
        <p className="legal-eyebrow">PRIVACY NOTICE</p>
        <h1>What we collect, and why.</h1>
        <p className="legal-updated">Last updated: 22 October 2026</p>
        <p className="legal-lede">
          Thoughtfully AI is a planning workspace for Indian occasions, shopping lists, calendars and reminders.
          This notice describes the data the product actually handles today. It is written to match the implementation,
          not to make promises the software cannot keep.
        </p>

        <nav className="legal-toc" aria-label="On this page">
          <a href="#account">Account data</a>
          <a href="#planning">Planning data</a>
          <a href="#verification">Device verification</a>
          <a href="#billing">Billing</a>
          <a href="#export-delete">Export &amp; deletion</a>
          <a href="#contact">Contact</a>
        </nav>

        <section id="account">
          <h2>1. Account and workspace data</h2>
          <p>
            When you create an account we store your email address, your name if you provide one, and the
            workspaces you belong to. Workspace membership, roles and the active workspace are kept in our
            Supabase database so that lists and plans stay separate between families, teams or clients.
          </p>
          <p>
            Sign-in is handled by Supabase Auth. Passwords are managed by Supabase and are never visible to us.
            We also record the browser (“device”) used to sign in — browser details, IP address and approximate
            location derived from that IP — so a new device can trigger a sign-in alert to the workspace administrator.
          </p>
        </section>

        <section id="planning">
          <h2>2. Planning data</h2>
          <p>
            Shopping lists, items, prices and occasions are saved in your own browser storage, separated by
            workspace, so they stay on the device you used. Reminders and push subscriptions are stored in our
            database so the reminder service can send the notifications you turn on.
          </p>
          <p>
            AI features send the text you submit — such as a rough list or an occasion description — to our
            language-model provider so a checklist or review can be generated. Do not include sensitive personal
            information in those prompts. If you import an Instagram post, the link and extracted caption or
            screenshot are processed to build the checklist.
          </p>
        </section>

        <section id="verification">
          <h2>3. Consent-based device verification</h2>
          <p>
            New-device verification is a safety feature, not background surveillance. A photo is captured only
            after you read the notice, tick the consent box and press <strong>Turn on camera</strong>. No audio is
            recorded and the camera is not accessed before that action.
          </p>
          <p>When you choose to verify, the following is stored and shared with the workspace administrator:</p>
          <ul>
            <li>a single still photo from your camera;</li>
            <li>your account email and name (if provided);</li>
            <li>the IP address, browser details and approximate location of the request;</li>
            <li>the consent version, timestamp and device identifier.</li>
          </ul>
          <p>
            The administrator recipient is the security contact configured for the service
            (<a href={`mailto:${contactEmail}`}>{contactEmail}</a>). Photos are kept privately in a non-public
            storage bucket and are deleted automatically after <strong>30 days</strong>; the retention period may be
            shorter if the operator configures it that way.
          </p>
          <p>
            <strong>Verification can be mandatory.</strong> Where the workspace operator has enabled required
            verification, you must complete it to keep using the planner, or sign out instead. If you cannot use a
            camera, contact the administrator for an alternative check. You can review and delete your verification
            history at any time from <Link href="/security">the security page</Link>. Signing out ends the current
            browser session.
          </p>
        </section>

        <section id="billing">
          <h2>4. Billing and subscriptions</h2>
          <p>
            Thoughtfully starts with a 7-day free trial, followed by an annual subscription of ₹200 per year if
            you choose to continue. Checkout and payment processing are handled by the payment provider shown at
            checkout. We receive subscription status and renewal information, not your full card details.
          </p>
          <p>
            If you cancel, the plan remains active until the end of the paid period unless the checkout flow says
            otherwise. You can ask about a subscription from the contact address below.
          </p>
        </section>

        <section id="export-delete">
          <h2>5. Your account: export and deletion</h2>
          <p>
            The <Link href="/account">account page</Link> lets you download a JSON copy of your profile, workspace
            memberships, subscription status, verification metadata and login devices. It deliberately excludes
            verification photos and signed image links.
          </p>
          <p>
            The account page also includes a danger zone that permanently deletes your account. Deletion removes
            your verification photos from private storage, deletes the Supabase Auth user and cascades to related
            rows such as workspace memberships, devices, verifications and reminders. This cannot be undone.
          </p>
          <p>
            You can delete verification photos without deleting your account from <Link href="/security">/security</Link>.
            Individual photos also expire automatically under the retention period described above.
          </p>
        </section>

        <section id="contact">
          <h2>6. Contact</h2>
          <p>
            Questions about this notice, a subscription, or a deletion request that you cannot complete in the app?
            Email <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </p>
          <p className="legal-note">
            <ShieldCheck size={14} /> Thoughtfully does not sell personal data, and does not use the camera or
            microphone for covert capture. Device verification is always initiated by the signed-in person.
          </p>
        </section>

        <footer className="legal-footer">
          <Link href="/"><ArrowLeft size={13} /> Back to Thoughtfully</Link>
          <Link href="/terms">Read the terms</Link>
          <a href={`mailto:${contactEmail}`}><Mail size={13} /> {contactEmail}</a>
        </footer>
      </article>
    </main>
  );
}
