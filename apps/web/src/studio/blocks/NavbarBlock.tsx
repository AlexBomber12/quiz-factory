type NavbarLink = {
  label: string;
  href: string;
};

type NavbarCta = {
  label: string;
  href: string;
};

export type NavbarBlockProps = {
  id?: string;
  brand: string;
  tagline?: string;
  links: NavbarLink[];
  cta: NavbarCta;
};

export function NavbarBlock({ id, brand, tagline, links, cta }: NavbarBlockProps) {
  return (
    <header id={id} className="studio-block studio-navbar">
      <div className="studio-navbar__brand">
        <div className="studio-mark" aria-hidden="true">
          QF
        </div>
        <div>
          <p className="studio-brand-title">{brand}</p>
          {tagline ? <p className="studio-brand-sub">{tagline}</p> : null}
        </div>
      </div>
      <nav className="studio-navbar__links" aria-label="Primary">
        {links.map((link) => (
          <a key={link.label} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <a className="studio-button" href={cta.href}>
        {cta.label}
      </a>
    </header>
  );
}
