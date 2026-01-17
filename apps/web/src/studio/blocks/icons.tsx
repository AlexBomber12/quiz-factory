import type { SVGProps } from "react";

export type StudioIconName = "spark" | "grid" | "signal" | "shield" | "check";

type StudioIconProps = {
  name: StudioIconName;
  title?: string;
  className?: string;
};

const iconProps: SVGProps<SVGSVGElement> = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round",
  strokeLinejoin: "round"
};

export function StudioIcon({ name, title, className }: StudioIconProps) {
  const ariaHidden = title ? undefined : true;
  const role = title ? "img" : undefined;

  return (
    <svg
      {...iconProps}
      className={className}
      aria-hidden={ariaHidden}
      role={role}
    >
      {title ? <title>{title}</title> : null}
      {name === "spark" ? (
        <path d="M12 3l2.6 5.8L21 11l-6.4 2.2L12 19l-2.6-5.8L3 11l6.4-2.2L12 3z" />
      ) : null}
      {name === "grid" ? (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </>
      ) : null}
      {name === "signal" ? (
        <>
          <path d="M4 14c2-2 4-3 8-3s6 1 8 3" />
          <path d="M7 17c1.5-1.5 3-2 5-2s3.5.5 5 2" />
          <path d="M10 20c.6-.6 1.4-1 2-1s1.4.4 2 1" />
        </>
      ) : null}
      {name === "shield" ? (
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
      ) : null}
      {name === "check" ? <path d="M5 12l4 4 10-10" /> : null}
    </svg>
  );
}
