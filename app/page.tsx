import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarDays,
  Check,
  ClipboardCheck,
  Flower2,
  Leaf,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import "./landing.css";

export const metadata: Metadata = {
  title: "Thoughtfully — plan what matters",
  description:
    "A calm planning companion for Indian occasions: review shopping lists with AI, keep a festival calendar, set reminders and verify new devices with consent.",
};

const capabilities = [
  {
    icon: Sparkles,
    title: "AI shopping-list review",
    body: "Paste a rough list and get duplicates, missing essentials and practical savings — grouped by pooja, food, decor and more.",
  },
  {
    icon: CalendarDays,
    title: "Occasion calendar",
    body: "Keep family dates and Indian festivals in one place, then turn any occasion into a ready-to-use preparation checklist.",
  },
  {
    icon: BellRing,
    title: "Gentle reminders",
    body: "Get a nudge the day before an occasion, so the small details never arrive as a last-minute scramble.",
  },
  {
    icon: ShieldCheck,
    title: "Consent-based device checks",
    body: "New devices can be verified with a photo you choose to take. Nothing is captured in the background, and you can sign out instead.",
  },
];

const steps = [
  {
    number: "01",
    title: "Add what you are planning",
    body: "Start with an occasion, a budget or a rough list. Everything begins empty — nothing is pre-filled for you.",
  },
  {
    number: "02",
    title: "Build the list together",
    body: "Let AI tidy the essentials, estimate a budget and group items by category. Edit every item, quantity and rate.",
  },
  {
    number: "03",
    title: "Keep the moment",
    body: "Save the date, set a reminder and come back to a plan that already knows what matters.",
  },
];

export default function LandingPage() {
  return (
    <main className="landing">
      <header className="landing-header">
        <div className="landing-nav">
          <Link href="/" className="landing-logo" aria-label="Thoughtfully home">
            <span className="landing-logo-mark"><Flower2 size={19} /></span>
            <span className="landing-logo-text">thoughtfully<span>AI</span></span>
          </Link>
          <nav className="landing-links" aria-label="Public">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </nav>
          <div className="landing-nav-actions">
            <Link href="/login" className="landing-button quiet">Sign in</Link>
            <Link href="/login" className="landing-button primary">Start free trial <ArrowRight size={15} /></Link>
          </div>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow"><span /> A CALMER WAY TO PLAN</p>
          <h1>Make room for <em>what matters.</em></h1>
          <p className="landing-lede">
            Thoughtfully is a quiet planning companion for Indian occasions. Review shopping lists,
            keep the festival calendar and remember the little details — without the last-minute panic.
          </p>
          <div className="landing-cta-row">
            <Link href="/login" className="landing-button primary large">Start your 7-day free trial <ArrowRight size={16} /></Link>
            <Link href="/subscribe" className="landing-button quiet large">See pricing</Link>
          </div>
          <ul className="landing-trust">
            <li><Check size={14} /> Starts completely empty</li>
            <li><Check size={14} /> Private by workspace</li>
            <li><Check size={14} /> Consent-first device checks</li>
          </ul>
        </div>

        <div className="landing-hero-visual" aria-hidden="true">
          <div className="landing-orb" />
          <div className="landing-preview-card">
            <div className="landing-preview-label"><span className="landing-dot" /> EXAMPLE · NOTHING IS SAVED</div>
            <div className="landing-preview-head">
              <div>
                <p>Diwali at home</p>
                <strong>Pooja &amp; family lunch</strong>
              </div>
              <span className="landing-preview-badge"><Wallet size={13} /> ₹2,400</span>
            </div>
            <ul className="landing-demo-list">
              <li><span className="landing-demo-check"><Check size={11} /></span> Diya set <span>×2</span></li>
              <li><span className="landing-demo-check"><Check size={11} /></span> Marigold garlands <span>×4</span></li>
              <li><span className="landing-demo-check empty" /> Kesari <span>500 g</span></li>
              <li><span className="landing-demo-check empty" /> Gift wrap <span>×3</span></li>
            </ul>
            <div className="landing-preview-foot">
              <span><Sparkles size={13} /> AI found 3 easy savings</span>
              <span className="landing-preview-pill">2 of 4 packed</span>
            </div>
          </div>
          <div className="landing-mini-calendar">
            <div className="landing-mini-month"><span>October</span><span>2026</span></div>
            <div className="landing-mini-grid">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => <span key={`${day}-${index}`} className="landing-mini-day">{day}</span>)}
              {[27, 28, 29, 30, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31].map((date, index) => (
                <span key={`${date}-${index}`} className={`landing-mini-date${date === 20 ? " marked" : ""}`}>{date}</span>
              ))}
            </div>
            <div className="landing-mini-event"><span className="landing-dot" /> Diwali prep · reminder at 9:00 AM</div>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="capabilities-title">
        <div className="landing-section-head">
          <p className="landing-eyebrow"><span /> WHAT IT HELPS WITH</p>
          <h2 id="capabilities-title">Small tools for <em>meaningful moments.</em></h2>
          <p>Everything is built around the way real families prepare: together, on a budget, and with a little care.</p>
        </div>
        <div className="landing-capability-grid">
          {capabilities.map(({ icon: Icon, title, body }) => (
            <article className="landing-capability" key={title}>
              <span className="landing-capability-icon"><Icon size={19} /></span>
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-demo-section" aria-labelledby="demo-title">
        <div className="landing-demo-copy">
          <p className="landing-eyebrow"><span /> A CLOSER LOOK</p>
          <h2 id="demo-title">A checklist that <em>thinks ahead.</em></h2>
          <p>
            Review a rough list before you shop. Thoughtfully spots duplicates, suggests missing
            essentials and keeps the estimated spend in view. The panel beside this is a static
            illustration — your own workspace always starts empty.
          </p>
          <ul className="landing-demo-points">
            <li><span><ClipboardCheck size={14} /></span> Grouped by category, with quantities and rates</li>
            <li><span><CalendarDays size={14} /></span> Occasion dates and festival days in one calendar</li>
            <li><span><BellRing size={14} /></span> Reminders the day before, at 9:00 AM IST</li>
          </ul>
          <Link href="/login" className="landing-button primary">Try it with your own list <ArrowRight size={15} /></Link>
        </div>
        <div className="landing-demo-panel">
          <div className="landing-demo-panel-head">
            <span className="landing-preview-label"><span className="landing-dot" /> ILLUSTRATIVE EXAMPLE · NOTHING IS SAVED</span>
            <span className="landing-preview-pill">Sample only</span>
          </div>
          <div className="landing-demo-group">
            <span className="landing-demo-group-title">Pooja &amp; rituals <small>2 items</small></span>
            <div className="landing-demo-row"><span className="landing-demo-check"><Check size={11} /></span><span>Diya set</span><span>×2</span></div>
            <div className="landing-demo-row"><span className="landing-demo-check"><Check size={11} /></span><span>Kumkum &amp; turmeric</span><span>1 set</span></div>
          </div>
          <div className="landing-demo-group">
            <span className="landing-demo-group-title">Food &amp; groceries <small>3 items</small></span>
            <div className="landing-demo-row"><span className="landing-demo-check empty" /><span>Kesari</span><span>500 g</span></div>
            <div className="landing-demo-row"><span className="landing-demo-check empty" /><span>Cashews</span><span>250 g</span></div>
            <div className="landing-demo-row"><span className="landing-demo-check empty" /><span>Ghee</span><span>1 jar</span></div>
          </div>
          <div className="landing-demo-panel-foot">
            <span>Estimated total</span>
            <strong>₹2,400</strong>
          </div>
        </div>
      </section>

      <section className="landing-section" aria-labelledby="steps-title">
        <div className="landing-section-head">
          <p className="landing-eyebrow"><span /> HOW IT WORKS</p>
          <h2 id="steps-title">Three steps, <em>then breathe.</em></h2>
        </div>
        <div className="landing-steps">
          {steps.map((step) => (
            <article className="landing-step" key={step.number}>
              <span className="landing-step-number">{step.number}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-pricing-section" aria-labelledby="pricing-title">
        <div className="landing-pricing">
          <div className="landing-pricing-copy">
            <p className="landing-eyebrow"><span /> SIMPLE PRICING</p>
            <h2 id="pricing-title">A full year of <em>thoughtful planning.</em></h2>
            <p>Start with a 7-day free trial. Keep every list, calendar and reminder for less than the price of a filter coffee each month.</p>
            <ul className="landing-pricing-list">
              <li><Check size={14} /> Unlimited lists, occasions and reminders</li>
              <li><Check size={14} /> AI checklist review and Instagram import</li>
              <li><Check size={14} /> Private workspaces with consent-based device checks</li>
            </ul>
            <div className="landing-cta-row">
              <Link href="/subscribe" className="landing-button primary large">Start 7-day free trial <ArrowRight size={16} /></Link>
              <Link href="/login" className="landing-button quiet large">I already have an account</Link>
            </div>
          </div>
          <div className="landing-price-card">
            <span className="landing-price-tag">EARLY ACCESS</span>
            <div className="landing-price">
              <span>₹</span><strong>200</strong><small>/ year</small>
            </div>
            <p>After a 7-day free trial. No long lock-in, one simple annual price.</p>
            <div className="landing-price-rule" />
            <ul>
              <li><Check size={14} /> 7 days free, cancel anytime before billing</li>
              <li><Check size={14} /> Built for families and small teams</li>
              <li><Check size={14} /> Your data stays in your workspace</li>
            </ul>
            <Link href="/subscribe" className="landing-button primary full">Choose annual plan <ArrowRight size={15} /></Link>
          </div>
        </div>
      </section>

      <section className="landing-closing">
        <span className="landing-closing-icon"><Leaf size={22} /></span>
        <p className="landing-eyebrow"><span /> THOUGHTFUL DOESN&apos;T MEAN EXPENSIVE</p>
        <h2>The best plans make room for <em>what matters to you.</em></h2>
        <div className="landing-cta-row centered">
          <Link href="/login" className="landing-button primary large">Start free <ArrowRight size={16} /></Link>
          <Link href="/subscribe" className="landing-button quiet large">See the plan</Link>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div className="landing-footer-brand">
            <span className="landing-logo-mark small"><Flower2 size={16} /></span>
            <span>thoughtfully<span className="landing-footer-badge">AI</span></span>
          </div>
          <p>Made for meaningful moments in India. A calm place to plan, prepare and remember.</p>
          <nav className="landing-footer-links" aria-label="Footer">
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/login">Sign in</Link>
            <Link href="/subscribe">Pricing</Link>
          </nav>
          <p className="landing-footer-note">
            <ListChecks size={13} /> Your planner always starts empty. The example on this page is static and never saved.
          </p>
        </div>
      </footer>
    </main>
  );
}
