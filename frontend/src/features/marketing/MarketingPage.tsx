/**
 * Marketing / Pricing Landing Page
 *
 * The logged-out front door for Bushie Tools. Explains what the suite is and
 * who it's for, shows the plan tiers, and funnels visitors into self-service
 * sign-up → Stripe Checkout. Once a visitor is signed in, the app-picker
 * (LandingPage) becomes their home instead — see HomeRoute in App.tsx.
 *
 * Copy follows the "bushie ethos": plain, warm, direct language aimed at the
 * crew on the ground — fire brigades, SES units, and other volunteer services —
 * not the IT manager. No jargon (SaaS / multi-tenant / API).
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTheme } from '../../hooks/useTheme';
import { PageTransition } from '../../components/PageTransition';
import './MarketingPage.css';

type BillingInterval = 'monthly' | 'annual';

interface PlanCard {
  code: 'community' | 'basic' | 'ai';
  name: string;
  tagline: string;
  monthly: number;
  annual: number;
  features: string[];
  cta: string;
  highlighted?: boolean;
}

// Prices mirror backend/src/constants/plans.ts and the live Stripe products.
// Keep these in sync if the plan catalog changes.
const PLAN_CARDS: PlanCard[] = [
  {
    code: 'community',
    name: 'Community',
    tagline: 'For any crew getting started',
    monthly: 0,
    annual: 0,
    features: [
      'Sign-in book — up to 10 members',
      'Vehicle checks for 1 vehicle',
      'Real-time on every device',
      'No card required',
    ],
    cta: 'Try it free',
  },
  {
    code: 'basic',
    name: 'Basic',
    tagline: 'The full manual toolkit',
    monthly: 10,
    annual: 100,
    features: [
      'Everything in Community',
      'Unlimited members & vehicles',
      'Reports & history + CSV export',
      'Multiple stations',
    ],
    cta: 'Get Basic',
    highlighted: true,
  },
  {
    code: 'ai',
    name: 'AI Pro',
    tagline: 'Add the AI review assistant',
    monthly: 19,
    annual: 190,
    features: [
      'Everything in Basic',
      'AI-facilitated After Action Reviews',
      '~25 AI sessions a month',
      'Live collaborative review notes',
    ],
    cta: 'Get AI Pro',
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: 'What is an After Action Review?',
    a: 'A quick chat after a job or training to capture what went well and what to improve. AAR Studio listens along, sorts the discussion into findings, and writes up a tidy report so nobody has to take notes.',
  },
  {
    q: 'Do I need to be good with computers?',
    a: 'No. If you can tap a big button on a tablet, you can run the sign-in book and a vehicle check. We built this for volunteers on the ground, not for an IT department.',
  },
  {
    q: 'Is our crew’s data safe?',
    a: 'Yes. Your members and records are kept private to your crew and only your signed-in people can see them. The public only ever sees a demo with made-up data.',
  },
  {
    q: 'What does the AI actually do?',
    a: 'On the AI Pro plan it runs the After Action Review for you — it follows the conversation, pulls out the findings, and drafts the report. You stay in charge and can edit anything before you share it.',
  },
  {
    q: 'Can we pay by invoice?',
    a: 'Many crews are grant or council funded and budget yearly. Choose annual billing for a single invoice (two months free), or get in touch and we’ll sort out a bank-transfer invoice.',
  },
];

export function MarketingPage() {
  const { theme, toggleTheme } = useTheme();
  const [interval, setInterval] = useState<BillingInterval>('monthly');

  const planHref = (code: PlanCard['code']) =>
    code === 'community' ? '/signup' : `/signup?plan=${code}&interval=${interval}`;

  const priceLabel = (plan: PlanCard) => {
    if (plan.monthly === 0) return 'Free';
    return interval === 'monthly' ? `A$${plan.monthly}` : `A$${plan.annual}`;
  };

  const priceUnit = (plan: PlanCard) => {
    if (plan.monthly === 0) return 'forever';
    return interval === 'monthly' ? 'per month' : 'per year';
  };

  return (
    <PageTransition variant="fade">
      <div className="marketing-page">
        <header className="mkt-header">
          <div className="mkt-header-inner">
            <div className="mkt-brand">
              <img
                src="/apple-touch-icon.png"
                alt="Bushie Tools logo"
                className="mkt-brand-mark"
                width={48}
                height={48}
                loading="eager"
                decoding="async"
              />
              <span className="mkt-brand-name">Bushie Tools</span>
            </div>
            <nav className="mkt-nav" aria-label="Primary">
              <a href="#pricing" className="mkt-nav-link">Pricing</a>
              <a href="#faq" className="mkt-nav-link">FAQ</a>
              <Link to="/login" className="mkt-nav-link">Log in</Link>
              <Link to="/signup" className="mkt-btn mkt-btn--primary mkt-nav-cta">Sign up free</Link>
              <button
                type="button"
                className="mkt-theme-toggle"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
                title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
              >
                <span aria-hidden="true">{theme === 'light' ? '🌙' : '☀️'}</span>
              </button>
            </nav>
          </div>
        </header>

        <main id="main-content" className="mkt-main" tabIndex={-1}>
          {/* Hero */}
          <section className="mkt-hero">
            <p className="mkt-eyebrow">Made for volunteer emergency crews</p>
            <h1 className="mkt-hero-title">
              Run your station the easy way
            </h1>
            <p className="mkt-hero-sub">
              Bushie Tools is a simple set of tools for volunteer brigades and
              units — a digital sign-in book, vehicle checks, and an AI helper
              that writes up your After Action Reviews. Built for the shed, not
              the office.
            </p>
            <div className="mkt-hero-actions">
              <Link to="/signup" className="mkt-btn mkt-btn--primary mkt-btn--lg">
                Try it free
              </Link>
              <a href="/?demo=true" className="mkt-btn mkt-btn--ghost mkt-btn--lg">
                Try the demo
              </a>
              <a href="#pricing" className="mkt-btn mkt-btn--ghost mkt-btn--lg">
                See plans
              </a>
            </div>
            <p className="mkt-hero-note">Free Community plan — no card needed. The demo uses test data — no sign-up.</p>
          </section>

          {/* Apps */}
          <section className="mkt-apps" aria-labelledby="apps-heading">
            <h2 id="apps-heading" className="mkt-section-title">What’s in the kit</h2>
            <div className="mkt-apps-grid">
              <article className="mkt-app-card">
                <div className="mkt-app-icon" aria-hidden="true">🔥</div>
                <h3>Station Manager</h3>
                <p>
                  Sign members in and out, see who’s out on the job, and run
                  your vehicle checks — all updating live on every tablet and
                  phone.
                </p>
              </article>
              <article className="mkt-app-card">
                <div className="mkt-app-icon" aria-hidden="true">🎙️</div>
                <h3>AAR Studio</h3>
                <p>
                  Have your debrief out loud. The AI listens, sorts out the
                  findings, and hands you a finished report — no note-taker needed.
                </p>
              </article>
              <article className="mkt-app-card mkt-app-card--soon">
                <div className="mkt-app-icon" aria-hidden="true">📐</div>
                <h3>Fire Break Calculator</h3>
                <p>Plan and size containment lines. Coming to the kit soon.</p>
                <span className="mkt-badge">Coming soon</span>
              </article>
              <article className="mkt-app-card mkt-app-card--soon">
                <div className="mkt-app-icon" aria-hidden="true">🎅</div>
                <h3>Fire Santa Run</h3>
                <p>Map and share your truck’s Christmas run. Coming to the kit soon.</p>
                <span className="mkt-badge">Coming soon</span>
              </article>
            </div>
          </section>

          {/* Pricing */}
          <section id="pricing" className="mkt-pricing" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading" className="mkt-section-title">Simple, crew-friendly pricing</h2>
            <p className="mkt-section-sub">
              One price per brigade or unit. No per-member charges, no surprises.
            </p>

            <div className="mkt-interval-toggle" role="group" aria-label="Billing period">
              <button
                type="button"
                className={`mkt-interval-btn ${interval === 'monthly' ? 'active' : ''}`}
                onClick={() => setInterval('monthly')}
                aria-pressed={interval === 'monthly'}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`mkt-interval-btn ${interval === 'annual' ? 'active' : ''}`}
                onClick={() => setInterval('annual')}
                aria-pressed={interval === 'annual'}
              >
                Annual
                <span className="mkt-interval-badge">2 months free</span>
              </button>
            </div>

            <div className="mkt-plans-grid">
              {PLAN_CARDS.map((plan) => (
                <article
                  key={plan.code}
                  className={`mkt-plan ${plan.highlighted ? 'mkt-plan--featured' : ''}`}
                >
                  {plan.highlighted && <span className="mkt-plan-flag">Most popular</span>}
                  <h3 className="mkt-plan-name">{plan.name}</h3>
                  <p className="mkt-plan-tagline">{plan.tagline}</p>
                  <p className="mkt-plan-price">
                    <span className="mkt-plan-amount">{priceLabel(plan)}</span>
                    <span className="mkt-plan-unit">{priceUnit(plan)}</span>
                  </p>
                  <ul className="mkt-plan-features">
                    {plan.features.map((f) => (
                      <li key={f}>{f}</li>
                    ))}
                  </ul>
                  <Link
                    to={planHref(plan.code)}
                    className={`mkt-btn ${plan.highlighted ? 'mkt-btn--primary' : 'mkt-btn--ghost'} mkt-plan-cta`}
                  >
                    {plan.cta}
                  </Link>
                </article>
              ))}

              <article className="mkt-plan mkt-plan--suite">
                <h3 className="mkt-plan-name">Bushie Suite</h3>
                <p className="mkt-plan-tagline">All the tools, one bill</p>
                <p className="mkt-plan-price">
                  <span className="mkt-plan-amount">Coming soon</span>
                </p>
                <ul className="mkt-plan-features">
                  <li>Every Bushie tool together</li>
                  <li>One login, one subscription</li>
                  <li>Best value for active crews</li>
                </ul>
                <a href="mailto:hello@bushietools.au?subject=Bushie%20Suite%20waitlist" className="mkt-btn mkt-btn--ghost mkt-plan-cta">
                  Join the waitlist
                </a>
              </article>
            </div>

            <p className="mkt-gst-note">
              All prices in Australian dollars and include GST. Need to pay by
              invoice? <a href="mailto:hello@bushietools.au?subject=Invoice%20billing">Get in touch</a>.
            </p>
          </section>

          {/* FAQ */}
          <section id="faq" className="mkt-faq" aria-labelledby="faq-heading">
            <h2 id="faq-heading" className="mkt-section-title">Questions, answered plainly</h2>
            <div className="mkt-faq-list">
              {FAQS.map((item) => (
                <details key={item.q} className="mkt-faq-item">
                  <summary>{item.q}</summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Final CTA */}
          <section className="mkt-final-cta">
            <h2>Ready to give your crew a hand?</h2>
            <p>Start free in a couple of minutes. Upgrade whenever you’re ready.</p>
            <Link to="/signup" className="mkt-btn mkt-btn--primary mkt-btn--lg">
              Create your free account
            </Link>
          </section>
        </main>

        <footer className="mkt-footer">
          <div className="mkt-footer-inner">
            <span>Built with ❤️ for the volunteer community</span>
            <span className="mkt-footer-sep">•</span>
            <Link to="/login" className="mkt-footer-link">Log in</Link>
            <span className="mkt-footer-sep">•</span>
            <a href="/?demo=true" className="mkt-footer-link">See a demo</a>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
}
