import { StudioIcon, type StudioIconName } from "./icons";

type HowItWorksStep = {
  title: string;
  description: string;
  icon: StudioIconName;
};

export type HowItWorksBlockProps = {
  id?: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
  steps: HowItWorksStep[];
};

export function HowItWorksBlock({
  id,
  eyebrow,
  title,
  subtitle,
  steps
}: HowItWorksBlockProps) {
  return (
    <section id={id} className="studio-block studio-how">
      <div className="studio-section__header">
        <p className="studio-eyebrow">{eyebrow}</p>
        <h2 className="studio-section-title">{title}</h2>
        {subtitle ? <p className="studio-section-lede">{subtitle}</p> : null}
      </div>
      <div className="studio-steps">
        {steps.map((step, index) => (
          <div key={step.title} className="studio-step-card">
            <div className="studio-step__icon">
              <StudioIcon name={step.icon} className="studio-icon" />
            </div>
            <div className="studio-step__meta">
              <span className="studio-step__index">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
