import type { CSSProperties } from "react";

import type { ThemeTokens } from "./tokens";

export function applyTheme(tokens: ThemeTokens): CSSProperties {
  return {
    "--radius": tokens.radius,
    "--font-sans": tokens.font_sans,
    "--color-primary": tokens.colors.primary_hsl,
    "--primary": tokens.colors.primary_hsl
  } as CSSProperties;
}
