import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type ThemeTokens = {
  id: string;
  font_sans: string;
  radius: string;
  colors: {
    primary_hsl: string;
  };
};

const resolveTokenPath = (): string => {
  const start = process.cwd();
  let current = start;

  for (let depth = 0; depth < 6; depth += 1) {
    const candidate = resolve(current, "themes", "default.json");
    if (existsSync(candidate)) {
      return candidate;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error(`Theme tokens not found from ${start}`);
};

const rawTokens = JSON.parse(readFileSync(resolveTokenPath(), "utf8")) as ThemeTokens;

export const themeTokens = rawTokens;
