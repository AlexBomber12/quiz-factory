import { FaqBlock } from "../../../studio/blocks/FaqBlock";
import { FooterBlock } from "../../../studio/blocks/FooterBlock";
import { HeroBlock } from "../../../studio/blocks/HeroBlock";
import { HowItWorksBlock } from "../../../studio/blocks/HowItWorksBlock";
import { NavbarBlock } from "../../../studio/blocks/NavbarBlock";
import { SocialProofBlock } from "../../../studio/blocks/SocialProofBlock";

export default function GoldenPage() {
  return (
    <div className="studio-stack">
      <NavbarBlock
        id="top"
        brand="Quiz Factory"
        tagline="Golden landing reference"
        links={[
          { label: "How it works", href: "#how" },
          { label: "Proof", href: "#proof" },
          { label: "FAQ", href: "#faq" }
        ]}
        cta={{ label: "Launch a test", href: "/t/focus-rhythm" }}
      />
      <HeroBlock
        id="hero"
        variant="split"
        kicker="Template Studio"
        headline="Ship quiz landings with less guesswork."
        subheadline="Compose pages from tuned blocks, keep the copy crisp, and let performance data guide the next iteration."
        primaryCta={{ label: "Build a landing", href: "#how" }}
        secondaryCta={{ label: "Browse blocks", href: "/studio/blocks" }}
        highlights={[
          "Three blocks are enough for a first launch.",
          "Swap variants without changing layout.",
          "Metrics stay aligned with the studio catalog."
        ]}
        stats={[
          { label: "Average build", value: "3 hrs" },
          { label: "Blocks ready", value: "6" },
          { label: "Locales shipped", value: "12" }
        ]}
      />
      <HowItWorksBlock
        id="how"
        eyebrow="How it works"
        title="A repeatable flow for every quiz launch."
        subtitle="Treat the studio like a kitchen: prep the blocks, plate the page, then serve it."
        steps={[
          {
            title: "Pick the block sequence",
            description:
              "Start with the golden order, then swap in variants that fit the test.",
            icon: "grid"
          },
          {
            title: "Fill with test-specific copy",
            description:
              "Replace headlines and FAQs with language from the actual results.",
            icon: "spark"
          },
          {
            title: "Ship with guardrails",
            description:
              "The shared layout keeps tracking, consent, and pricing consistent.",
            icon: "shield"
          }
        ]}
      />
      <SocialProofBlock
        id="proof"
        variant="testimonials"
        title="Teams move faster when the layout is settled."
        subtitle="Short quotes, real outcomes, no fluff."
        testimonials={[
          {
            quote:
              "We rebuilt a new quiz page in one morning and still hit the funnel targets.",
            name: "Mara L.",
            role: "Growth Lead"
          },
          {
            quote:
              "The blocks keep us honest. If the offer changes, we swap the copy and ship.",
            name: "Joao P.",
            role: "Lifecycle Marketing"
          },
          {
            quote:
              "We finally have a shared baseline instead of every launch feeling custom.",
            name: "Priya S.",
            role: "Product Design"
          }
        ]}
      />
      <FaqBlock
        id="faq"
        title="Golden page FAQs"
        subtitle="Answers for anyone building or reviewing a landing page."
        items={[
          {
            question: "Can I reorder blocks?",
            answer:
              "Start from the golden order, then move sections only when a test calls for it."
          },
          {
            question: "How do variants work?",
            answer:
              "Each block accepts a variant prop; copy stays in place while layout shifts."
          },
          {
            question: "Can I add imagery?",
            answer:
              "Prefer icons and abstract accents. Only add images if they are local and essential."
          },
          {
            question: "What if the copy is long?",
            answer:
              "Trim first. Long answers belong in the report, not the landing page."
          },
          {
            question: "Who approves new blocks?",
            answer:
              "Product design and analytics sign off before new blocks land in the studio."
          }
        ]}
      />
      <FooterBlock
        id="footer"
        brand="Quiz Factory"
        tagline="Internal studio for consistent launches."
        links={[
          { label: "Blocks catalog", href: "/studio/blocks" },
          { label: "Golden page", href: "/studio/golden" },
          { label: "Back to app", href: "/" }
        ]}
        note="Golden template. Keep it tight, keep it measurable."
      />
    </div>
  );
}
