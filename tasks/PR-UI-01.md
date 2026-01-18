PR-UI-01: Tailwind + shadcn/ui Foundation (Design Tokens, Layout, Primitives)

Read and follow AGENTS.md strictly.

Context
- apps/web is a Next.js app-router project in a pnpm monorepo.
- We want to build the product UI with Tailwind CSS and shadcn/ui.
- We do not use Tailwind Plus.
- Keep the UI minimal, fast, and mobile-first.

Goal
- Add Tailwind CSS to apps/web.
- Add the minimal shadcn/ui foundation: cn helper, Button, Card, Badge, Separator.
- Establish design tokens (CSS variables) and a consistent layout baseline.
- Ensure the dev and CI gates still pass.

Workflow rules
- Create a new branch from main named: pr-ui-01-tailwind-shadcn-foundation
- Implement only what this task requests.
- Do not commit secrets.
- Keep everything in English.
- Avoid using em dashes; use hyphens.
- Run the project test gate locally before committing.

Task A: Tailwind installation and configuration
A1) Add Tailwind dependencies to apps/web:
- tailwindcss
- postcss
- autoprefixer

A2) Create Tailwind config for apps/web:
- apps/web/tailwind.config.ts
- apps/web/postcss.config.js

A3) Add a global stylesheet:
- apps/web/src/app/globals.css
Include:
- Tailwind base, components, utilities
- CSS variables for theme tokens
- basic body background and foreground colors

A4) Import globals.css from apps/web/src/app/layout.tsx.

Task B: shadcn/ui minimal primitives
B1) Add dependencies used by shadcn/ui:
- class-variance-authority
- clsx
- tailwind-merge
- lucide-react

B2) Add cn helper:
- apps/web/src/lib/ui/cn.ts
Export function cn(...inputs) using clsx + tailwind-merge.

B3) Add shadcn/ui primitives under:
- apps/web/src/components/ui/

Implement:
- button.tsx
- card.tsx
- badge.tsx
- separator.tsx

Notes
- Use the standard shadcn/ui implementations.
- Use forwardRef, variants, and cn helper.
- Keep components un-opinionated.

Task C: Base layout and typography
C1) Update apps/web/src/app/layout.tsx:
- Use a centered max-width container and consistent padding.
- Add a simple header and footer slots (no navigation logic yet).
- Ensure the default page typography looks acceptable with Tailwind classes.

C2) Replace any demo math content on the homepage with a minimal neutral placeholder:
- title
- short text
Do not introduce product-specific UI yet.

Task D: Developer documentation
D1) Add docs/ui.md with:
- how to run the web app
- where UI components live
- how to add new shadcn/ui components
- naming conventions

Task E: Tests and gates
E1) Ensure scripts/ci.sh passes locally.
E2) Ensure pnpm lint, pnpm typecheck, pnpm test, pnpm build for apps/web pass.

Success criteria
- Tailwind styles load in dev and production build.
- The homepage renders using the new layout and primitives.
- No Tailwind Plus dependency is introduced.
- scripts/ci.sh exits 0.
