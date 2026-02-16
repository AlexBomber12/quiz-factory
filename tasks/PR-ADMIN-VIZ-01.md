PR-ADMIN-VIZ-01: Admin Analytics Visualization with Apache ECharts

Read and follow AGENTS.md strictly.

Context
- The analytics section exists and is functional, but it is mostly tables and cards.
- The admin is now a domains control panel; analytics must become a BI-style visual cockpit (PowerBI-like).
- We will standardize on Apache ECharts for charting.

Goal
- Upgrade Admin Analytics pages to a visual BI-style experience using Apache ECharts:
  - KPI cards + trends
  - time-series charts
  - funnel charts (where applicable)
  - distribution/stacked charts (tenant x test, revenue mix)
- Keep the existing provider abstraction and API contract intact.

Non-goals
- Do not change the underlying analytics data model (BigQuery/content_db/mock) in this PR.
- Do not add new metrics in this PR; focus on visualization and UX.

Implementation requirements
- Dependencies
  - Add to apps/web/package.json:
    - echarts
    - echarts-for-react
- Chart foundation
  - Create reusable client components under apps/web/src/components/admin/charts:
    - AdminChart.tsx (dynamic import, ssr:false)
    - helpers to build consistent ECharts options (axes, tooltips, grid, empty state)
  - Ensure charts render only on the client and do not break SSR.
- UI upgrades (use existing routes)
  - /admin/analytics (overview)
  - /admin/analytics/traffic
  - /admin/analytics/revenue
  - /admin/analytics/tenants
  - /admin/analytics/tests
  - /admin/analytics/distribution
  - /admin/analytics/data
  - Replace or complement existing tables with ECharts visuals:
    - line/area for time series
    - stacked bar for breakdowns
    - funnel for conversion steps
    - heatmap for distribution matrix if appropriate
  - Add small sparklines on KPI cards where useful (ECharts mini line).
- Filters
  - Keep the existing global FilterBar behavior.
  - Ensure changing filters updates all charts deterministically.
- Performance
  - Avoid rendering huge datasets in the browser; aggregate server-side via existing API.
  - Charts must handle empty data gracefully.
- Testing
  - Update/extend existing admin analytics page tests if they assert DOM structure.
  - Ensure Playwright visual suite remains stable (update golden snapshots only if required by task).

Workflow rules
- Create a new branch from main named: pr-admin-viz-01-echarts
- Implement only what this task requests.

Definition of Done
- Admin analytics pages render charts using ECharts (no React hydration errors).
- Filters drive chart updates.
- Empty states are handled and readable.
- scripts/ci.sh --scope app passes.
