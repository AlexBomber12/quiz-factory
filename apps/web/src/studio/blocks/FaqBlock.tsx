type FaqItem = {
  question: string;
  answer: string;
};

export type FaqBlockProps = {
  id?: string;
  title: string;
  subtitle?: string;
  items: FaqItem[];
};

export function FaqBlock({ id, title, subtitle, items }: FaqBlockProps) {
  return (
    <section id={id} className="studio-block studio-faq">
      <div className="studio-section__header">
        <p className="studio-eyebrow">FAQ</p>
        <h2 className="studio-section-title">{title}</h2>
        {subtitle ? <p className="studio-section-lede">{subtitle}</p> : null}
      </div>
      <div className="studio-faq__list">
        {items.map((item) => (
          <details key={item.question}>
            <summary>{item.question}</summary>
            <p>{item.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
