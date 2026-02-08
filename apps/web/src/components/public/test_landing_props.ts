import type { CatalogTest } from "../../lib/catalog/catalog";
import type { PublishedTenantTest } from "../../lib/content/provider";
import type { FaqBlockProps } from "../../studio/blocks/FaqBlock";
import type { FooterBlockProps } from "../../studio/blocks/FooterBlock";
import type { HeroBlockProps } from "../../studio/blocks/HeroBlock";
import type { HowItWorksBlockProps } from "../../studio/blocks/HowItWorksBlock";
import type { NavbarBlockProps } from "../../studio/blocks/NavbarBlock";
import type { SocialProofBlockProps } from "../../studio/blocks/SocialProofBlock";

type PublishedLandingSpec = Pick<PublishedTenantTest, "spec" | "test"> | null;

const FALLBACK_CATEGORY = "Quiz";
const FALLBACK_SUBHEADLINE =
  "Get a clear snapshot in minutes, then unlock a deeper report with practical next steps.";
const FALLBACK_MINUTES = 5;
const FALLBACK_QUESTION_COUNT = 10;

export const TEST_LANDING_ANCHORS = Object.freeze({
  top: "top",
  hero: "hero",
  how: "how",
  whatYouGet: "what-you-get",
  proof: "proof",
  faq: "faq",
  footer: "footer"
});

export type TestLandingAnchors = typeof TEST_LANDING_ANCHORS;

export type WhatYouGetSectionProps = {
  id: string;
  title: string;
  subtitle: string;
  freePreview: {
    title: string;
    items: string[];
  };
  fullReport: {
    title: string;
    items: string[];
  };
  disclaimer: string;
};

export type TestLandingProps = {
  anchors: TestLandingAnchors;
  navbar: NavbarBlockProps;
  hero: HeroBlockProps;
  howItWorks: HowItWorksBlockProps;
  socialProof: SocialProofBlockProps;
  faq: FaqBlockProps;
  footer: FooterBlockProps;
  whatYouGet: WhatYouGetSectionProps;
};

const asNonEmptyString = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizePositiveInteger = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) {
    return fallback;
  }
  return Math.round(value);
};

export function buildTestLandingProps(
  test: CatalogTest,
  publishedSpec: PublishedLandingSpec
): TestLandingProps {
  const anchors = TEST_LANDING_ANCHORS;

  const category =
    asNonEmptyString(publishedSpec?.test.category) ??
    asNonEmptyString(publishedSpec?.spec.category) ??
    FALLBACK_CATEGORY;

  const subheadline =
    asNonEmptyString(test.short_description) ??
    asNonEmptyString(publishedSpec?.test.intro) ??
    FALLBACK_SUBHEADLINE;

  const estimatedMinutes = normalizePositiveInteger(
    test.estimated_minutes,
    FALLBACK_MINUTES
  );
  const questionCount = normalizePositiveInteger(
    publishedSpec?.spec.questions.length ?? publishedSpec?.test.questions.length ?? 0,
    FALLBACK_QUESTION_COUNT
  );

  return {
    anchors,
    navbar: {
      id: anchors.top,
      brand: "Quiz Factory",
      tagline: "Evidence-based self-assessment",
      links: [
        { label: "How it works", href: `#${anchors.how}` },
        { label: "Trust", href: `#${anchors.proof}` },
        { label: "FAQ", href: `#${anchors.faq}` }
      ],
      cta: { label: "Start test", href: `/t/${test.slug}/run` }
    },
    hero: {
      id: anchors.hero,
      variant: "split",
      kicker: category,
      headline: test.title,
      subheadline,
      primaryCta: { label: "Start test", href: `/t/${test.slug}/run` },
      secondaryCta: { label: "What's inside", href: `#${anchors.whatYouGet}` },
      stats: [
        { label: "Time", value: `${estimatedMinutes} min` },
        { label: "Questions", value: String(questionCount) },
        { label: "Report", value: "PDF + insights" }
      ]
    },
    howItWorks: {
      id: anchors.how,
      eyebrow: "How it works",
      title: "A practical flow from start to report",
      subtitle: "No account needed to begin.",
      steps: [
        {
          title: "Answer questions (no account)",
          description: "Complete the assessment in one short sitting.",
          icon: "grid"
        },
        {
          title: "Get free preview",
          description: "See your result headline and key score signals right away.",
          icon: "spark"
        },
        {
          title: "Unlock full report",
          description: "Get interpretation, action steps, and a downloadable PDF.",
          icon: "shield"
        }
      ]
    },
    socialProof: {
      id: anchors.proof,
      variant: "trust-bullets",
      title: "Built for clarity and trust",
      subtitle: "Straightforward experience with clear expectations.",
      bullets: [
        {
          title: "Privacy-aware tracking",
          description: "Analytics follow a strict event contract without extra personal data."
        },
        {
          title: "Clear pricing and access",
          description: "You can start free and choose paid access only when ready."
        },
        {
          title: "Instant report + PDF",
          description: "Get full insights immediately after checkout, plus printable output."
        }
      ]
    },
    faq: {
      id: anchors.faq,
      title: "Common questions before you start",
      subtitle: "What to expect from the free preview and full report.",
      items: [
        {
          question: "What is this test for?",
          answer:
            "It helps you quickly assess your current pattern and understand your strongest and weakest areas."
        },
        {
          question: "What do I get for free?",
          answer:
            "The free preview includes your result headline, a short summary, and a score breakdown."
        },
        {
          question: "What is included in the paid report?",
          answer:
            "The full report adds deep interpretation, an action plan, common pitfalls, and a printable PDF."
        },
        {
          question: "How long does it take?",
          answer: `Most people finish in about ${estimatedMinutes} minutes.`
        },
        {
          question: "Can I trust the process?",
          answer:
            "The flow is deterministic, tracking is privacy-aware, and pricing plus access are shown clearly."
        }
      ]
    },
    footer: {
      id: anchors.footer,
      brand: "Quiz Factory",
      tagline: "Actionable tests for everyday decisions",
      links: [
        { label: "Home", href: "/" },
        { label: "Tests", href: "/tests" },
        { label: "Privacy", href: "/privacy" }
      ],
      note: "Informational content only."
    },
    whatYouGet: {
      id: anchors.whatYouGet,
      title: "What you get",
      subtitle: "Start free, then unlock deeper guidance when you need it.",
      freePreview: {
        title: "Free preview includes",
        items: [
          "Result headline tailored to your response pattern.",
          "Short summary of what your score means.",
          "Score breakdown across key dimensions."
        ]
      },
      fullReport: {
        title: "Full report includes",
        items: [
          "Deep interpretation of your score profile.",
          "Action plan with practical next steps.",
          "Common pitfalls to avoid.",
          "Printable PDF for offline review."
        ]
      },
      disclaimer: "Informational only, not medical advice."
    }
  };
}
