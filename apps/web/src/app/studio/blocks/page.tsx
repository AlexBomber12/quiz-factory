import { FaqBlock } from "../../../studio/blocks/FaqBlock";
import { FooterBlock } from "../../../studio/blocks/FooterBlock";
import { HeroBlock } from "../../../studio/blocks/HeroBlock";
import { HowItWorksBlock } from "../../../studio/blocks/HowItWorksBlock";
import { NavbarBlock } from "../../../studio/blocks/NavbarBlock";
import { SocialProofBlock } from "../../../studio/blocks/SocialProofBlock";

export default function BlocksPage() {
  const heroStats = [
    { label: "Blocks ready", value: "6" },
    { label: "Build time", value: "2-4 hrs" },
    { label: "Share rate", value: "28%" }
  ];

  return (
    <div id="catalog" className="studio-catalog">
      <header className="studio-catalog__header">
        <p className="studio-eyebrow">Blocks catalog</p>
        <h1 className="studio-title">Every block and every variant.</h1>
        <p className="studio-lede">
          Use this page to review layout, spacing, and copy rhythm before launching.
        </p>
      </header>

      <div className="studio-catalog__list">
        <div className="studio-catalog__item">
          <div className="studio-catalog__meta">
            <h2>Navbar</h2>
            <p>Brand lockup, anchor links, and a single CTA.</p>
          </div>
          <NavbarBlock
            brand="Quiz Factory"
            tagline="Golden navigation"
            links={[
              { label: "How it works", href: "/studio/golden#how" },
              { label: "Proof", href: "/studio/golden#proof" },
              { label: "FAQ", href: "/studio/golden#faq" }
            ]}
            cta={{ label: "Start test", href: "/t/focus-rhythm" }}
          />
        </div>

        <div className="studio-catalog__item">
          <div className="studio-catalog__meta">
            <h2>Hero</h2>
            <p>Two variants: split panel and stacked signal card.</p>
          </div>
          <div className="studio-catalog__variant">
            <p className="studio-variant-label">Variant A — Split</p>
            <HeroBlock
              variant="split"
              kicker="Variant A"
              headline="Launch pages from a shared playbook."
              subheadline="The split hero keeps copy and signal side by side for fast reviews."
              headingLevel="h2"
              primaryCta={{ label: "Use this hero", href: "/studio/golden#hero" }}
              secondaryCta={{ label: "See the flow", href: "/studio/golden#how" }}
              highlights={[
                "Anchor blocks stay in the same order.",
                "Swap copy without rewriting layout."
              ]}
              stats={heroStats}
            />
          </div>
          <div className="studio-catalog__variant">
            <p className="studio-variant-label">Variant B — Stacked</p>
            <HeroBlock
              variant="stacked"
              kicker="Variant B"
              headline="Keep the layout, change the energy."
              subheadline="Stacked hero shifts the emphasis while keeping the same metrics panel."
              headingLevel="h2"
              primaryCta={{ label: "Pick stacked", href: "/studio/golden#hero" }}
              secondaryCta={{ label: "Review blocks", href: "/studio/blocks#catalog" }}
              highlights={[
                "Better for shorter headlines.",
                "Adds a callout without adding a new block."
              ]}
              stats={heroStats}
            />
          </div>
        </div>

        <div className="studio-catalog__item">
          <div className="studio-catalog__meta">
            <h2>How it works</h2>
            <p>Three-step flow with icon cards.</p>
          </div>
          <HowItWorksBlock
            eyebrow="How it works"
            title="A calm, repeatable launch sequence."
            subtitle="Keep the steps tight and the copy practical."
            steps={[
              {
                title: "Choose the flow",
                description: "Pick the golden order and only break it with reason.",
                icon: "grid"
              },
              {
                title: "Tune the copy",
                description: "Use the test's real insights to edit headlines and FAQs.",
                icon: "spark"
              },
              {
                title: "Check the guardrails",
                description: "Confirm tracking, pricing, and consent before shipping.",
                icon: "shield"
              }
            ]}
          />
        </div>

        <div className="studio-catalog__item">
          <div className="studio-catalog__meta">
            <h2>Social proof</h2>
            <p>Testimonials or trust bullets driven by a typed variant.</p>
          </div>
          <div className="studio-catalog__variant">
            <p className="studio-variant-label">Variant A — Testimonials</p>
            <SocialProofBlock
              variant="testimonials"
              title="Short quotes keep review cycles short."
              subtitle="Three voices max, each with a concrete result."
              testimonials={[
                {
                  quote: "We aligned on a single layout and shipped twice as fast.",
                  name: "Ezra K.",
                  role: "Marketing Ops"
                },
                {
                  quote: "Reviewing the golden page feels like a checklist now.",
                  name: "Danielle R.",
                  role: "Product Manager"
                },
                {
                  quote: "Copy edits are the only thing we touch week to week.",
                  name: "Marco T.",
                  role: "Growth"
                }
              ]}
            />
          </div>
          <div className="studio-catalog__variant">
            <p className="studio-variant-label">Variant B — Trust bullets</p>
            <SocialProofBlock
              variant="trust-bullets"
              title="Confidence signals for cautious audiences."
              subtitle="Use bullets when you need proof without direct quotes."
              bullets={[
                {
                  title: "Privacy-aware tracking",
                  description:
                    "Events follow the same contract across every template."
                },
                {
                  title: "Clear ownership",
                  description:
                    "Block changes require design and analytics signoff."
                },
                {
                  title: "Built-in QA",
                  description:
                    "FAQs and CTAs must pass the block checklist before shipping."
                }
              ]}
            />
          </div>
        </div>

        <div className="studio-catalog__item">
          <div className="studio-catalog__meta">
            <h2>FAQ</h2>
            <p>Expandable answers for common launch questions.</p>
          </div>
          <FaqBlock
            title="Block QA questions"
            subtitle="If a block fails one of these, revise before launch."
            items={[
              {
                question: "Does the headline match the test outcome?",
                answer:
                  "The hero headline should reflect the result, not the quiz mechanics."
              },
              {
                question: "Are we using only one primary CTA?",
                answer:
                  "Yes. The secondary CTA can link to details, but not compete."
              },
              {
                question: "Do the testimonials mention a concrete benefit?",
                answer:
                  "Replace vague praise with a measurable or observable outcome."
              },
              {
                question: "Is the copy trimmed to essentials?",
                answer:
                  "Remove marketing filler. Each line should earn its place."
              },
              {
                question: "Have we checked the tracking plan?",
                answer:
                  "Confirm the page_view event and any CTA tracking before release."
              }
            ]}
          />
        </div>

        <div className="studio-catalog__item">
          <div className="studio-catalog__meta">
            <h2>Footer</h2>
            <p>Lightweight wrap-up and quick links.</p>
          </div>
          <FooterBlock
            brand="Quiz Factory"
            tagline="Golden template footer"
            links={[
              { label: "View golden page", href: "/studio/golden" },
              { label: "Blocks catalog", href: "/studio/blocks" },
              { label: "Back to app", href: "/" }
            ]}
            note="Built for internal review only."
          />
        </div>
      </div>
    </div>
  );
}
