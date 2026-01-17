import { StudioIcon } from "./icons";

type HeroCta = {
  label: string;
  href: string;
};

type HeroStat = {
  label: string;
  value: string;
};

export type HeroVariant = "split" | "stacked";
type HeroHeadingLevel = "h1" | "h2";

export type HeroBlockProps = {
  id?: string;
  variant?: HeroVariant;
  kicker: string;
  headline: string;
  subheadline: string;
  headingLevel?: HeroHeadingLevel;
  primaryCta: HeroCta;
  secondaryCta?: HeroCta;
  highlights?: string[];
  stats: HeroStat[];
};

export function HeroBlock({
  id,
  variant = "split",
  kicker,
  headline,
  subheadline,
  headingLevel = "h1",
  primaryCta,
  secondaryCta,
  highlights,
  stats
}: HeroBlockProps) {
  const HeadingTag = headingLevel;

  return (
    <section id={id} className={`studio-block studio-hero studio-hero--${variant}`}>
      <div className="studio-hero__content">
        <p className="studio-eyebrow">{kicker}</p>
        <HeadingTag className="studio-title">{headline}</HeadingTag>
        <p className="studio-lede">{subheadline}</p>
        <div className="studio-hero__actions">
          <a className="studio-button" href={primaryCta.href}>
            {primaryCta.label}
          </a>
          {secondaryCta ? (
            <a className="studio-button studio-button--ghost" href={secondaryCta.href}>
              {secondaryCta.label}
            </a>
          ) : null}
        </div>
        {highlights && highlights.length > 0 ? (
          <ul className="studio-hero__highlights">
            {highlights.map((item) => (
              <li key={item}>
                <StudioIcon name="check" className="studio-icon" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="studio-hero__panel">
        <div className="studio-panel__header">
          <StudioIcon name="signal" className="studio-icon studio-icon--accent" />
          <div>
            <p className="studio-panel__title">Signal for every launch</p>
            <p className="studio-panel__subtitle">Watch how each test performs.</p>
          </div>
        </div>
        <div className="studio-panel__stats">
          {stats.map((stat) => (
            <div key={stat.label} className="studio-panel__stat">
              <span className="studio-panel__value">{stat.value}</span>
              <span className="studio-panel__label">{stat.label}</span>
            </div>
          ))}
        </div>
        {variant === "stacked" ? (
          <div className="studio-panel__note">
            <StudioIcon name="spark" className="studio-icon" />
            <span>Swap blocks, keep the system.</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
