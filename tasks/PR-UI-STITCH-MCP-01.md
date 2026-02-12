PR ID: PR-UI-STITCH-MCP-01
Branch: pr/ui-stitch-mcp-01

Goal
Export the “Tenant Home - Standard Grid” design from the Stitch MCP server and apply it to the Quiz Factory tenant homepage UI while keeping all existing behavior and backend routes unchanged.

Hard constraints
- Do not modify anything under apps/web/src/app/api/.
- Do not introduce new UI libraries. Use existing Tailwind and existing components in the repo.
- Preserve the exported Stitch visual design 1:1 (layout, spacing, typography, colors).
- Keep the current URL structure and navigation working.
- Keep Playwright gates green (including the visual gate, if present).

Step 1: Export Stitch reference artifacts
1) Ensure these paths exist (create folders if needed):
- docs/ui/stitch/

2) Use the configured Stitch MCP server (URL: https://stitch.googleapis.com/mcp).
3) Discover available MCP tools for Stitch, then:
- List projects.
- Select the most relevant project that contains a screen matching “Tenant Home - Standard Grid”.
  - If exact match is not found, select the closest screen containing “Tenant Home” and “Standard Grid”.
  - Prefer the most recently updated item.
- Export:
  - The screen HTML/code into docs/ui/stitch/tenant-home.standard-grid.html
  - The screen image/screenshot into docs/ui/stitch/tenant-home.standard-grid.png

4) Commit the exported reference files as part of this PR.

Step 2: Apply the design to the Next.js tenant homepage
1) Target the tenant homepage route:
- apps/web/src/app/page.tsx

2) Keep the page composition but update the UI to match the Stitch reference:
- Prefer updating existing components rather than rewriting the page from scratch.
- The most likely primary component to update is:
  - apps/web/src/components/public/TenantTestExplorer.tsx
- Update any related components that TenantTestExplorer depends on, but keep changes scoped to presentation.

3) Match the Stitch design features on the homepage:
- Top navigation styling consistent with the reference.
- Hero headline, subheadline, and search input styling consistent with the reference.
- Category tags/chips styling and behavior consistent with the reference.
- Featured assessments grid and test card styling consistent with the reference.
- Footer styling consistent with the reference.
- Responsive behavior: mobile, tablet, desktop.

4) Preserve functional behavior:
- Search must still work if it exists today.
- Category filtering must still work if it exists today.
- “Start” / “Take test” buttons must still navigate correctly.

Step 3: Update visual regression expectations
1) Run local gates:
- pnpm -w lint
- pnpm -w test
- pnpm -w e2e
- pnpm -w e2e-visual (if present)

2) If the visual gate is expected to change, update the stored screenshots in the same PR so that the gate becomes green again.

Commit and push
- Commit message: PR-UI-STITCH-MCP-01: apply Stitch Tenant Home standard grid UI
- Push branch pr/ui-stitch-mcp-01 and open PR.

Success criteria
- docs/ui/stitch/tenant-home.standard-grid.html exists and matches the exported Stitch code for that screen.
- apps/web tenant homepage visually matches docs/ui/stitch/tenant-home.standard-grid.png closely.
- No changes under apps/web/src/app/api/.
- All local gates are green, including the visual gate if it exists.
