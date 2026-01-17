import { StudioIcon } from "./icons";

type SocialProofTestimonial = {
  quote: string;
  name: string;
  role: string;
};

type SocialProofBullet = {
  title: string;
  description: string;
};

export type SocialProofVariant = "testimonials" | "trust-bullets";

export type SocialProofBlockProps = {
  id?: string;
  variant: SocialProofVariant;
  title: string;
  subtitle?: string;
  testimonials?: SocialProofTestimonial[];
  bullets?: SocialProofBullet[];
};

export function SocialProofBlock({
  id,
  variant,
  title,
  subtitle,
  testimonials,
  bullets
}: SocialProofBlockProps) {
  return (
    <section id={id} className="studio-block studio-proof">
      <div className="studio-section__header">
        <p className="studio-eyebrow">Trusted teams</p>
        <h2 className="studio-section-title">{title}</h2>
        {subtitle ? <p className="studio-section-lede">{subtitle}</p> : null}
      </div>
      {variant === "testimonials" ? (
        <div className="studio-testimonials">
          {(testimonials ?? []).map((item) => (
            <figure key={item.name} className="studio-quote">
              <blockquote>“{item.quote}”</blockquote>
              <figcaption>
                <span>{item.name}</span>
                <span>{item.role}</span>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="studio-trust">
          {(bullets ?? []).map((item) => (
            <div key={item.title} className="studio-trust-item">
              <div className="studio-trust-icon">
                <StudioIcon name="shield" className="studio-icon studio-icon--accent" />
              </div>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
