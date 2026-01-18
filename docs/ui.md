# UI

## Run the web app
- From the repo root: `pnpm --filter @quiz-factory/web dev`

## Where UI components live
- shadcn/ui primitives: `apps/web/src/components/ui`
- UI helpers: `apps/web/src/lib/ui`
- Global styles and tokens: `apps/web/src/app/globals.css`

## Add new shadcn/ui components
1. Copy the component source from the shadcn/ui docs.
2. Import `cn` from `../../lib/ui/cn` and keep the file in `apps/web/src/components/ui`.
3. Use Tailwind tokens like `bg-background` and `text-foreground` for colors.

## Naming conventions
- File names use kebab-case, for example `button.tsx`.
- Components use PascalCase.
- Prefer Tailwind utilities; add custom CSS only when necessary.
