type FooterLink = {
  label: string;
  href: string;
};

export type FooterBlockProps = {
  id?: string;
  brand: string;
  tagline: string;
  links: FooterLink[];
  note: string;
};

export function FooterBlock({ id, brand, tagline, links, note }: FooterBlockProps) {
  return (
    <footer id={id} className="studio-block studio-footer">
      <div className="studio-footer__brand">
        <div className="studio-mark" aria-hidden="true">
          QF
        </div>
        <div>
          <p className="studio-brand-title">{brand}</p>
          <p className="studio-brand-sub">{tagline}</p>
        </div>
      </div>
      <div className="studio-footer__links">
        {links.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </div>
      <p className="studio-footer__note">{note}</p>
    </footer>
  );
}
