import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getContentDbPool: vi.fn(),
  resolveAdminAnalyticsProviderMode: vi.fn()
}));

vi.mock("../content_db/pool", () => ({
  getContentDbPool: (...args: unknown[]) => mocks.getContentDbPool(...args)
}));

vi.mock("../admin_analytics/provider", () => ({
  resolveAdminAnalyticsProviderMode: (...args: unknown[]) =>
    mocks.resolveAdminAnalyticsProviderMode(...args)
}));

import { __resetAlertsProviderForTests, getAlertsProvider } from "./provider";

describe("ContentDbAlertsProvider query scoping", () => {
  beforeEach(() => {
    __resetAlertsProviderForTests();
    vi.clearAllMocks();

    mocks.resolveAdminAnalyticsProviderMode.mockReturnValue("content_db");
    mocks.getContentDbPool.mockReturnValue({ query: mocks.query });
    mocks.query.mockResolvedValue({ rows: [] });
  });

  it("does not apply purchase created-date window to purchase_dim scope", async () => {
    const provider = getAlertsProvider();

    await provider.getDailyMetrics({
      scope: {
        tenant_id: "tenant-tenant-example-com",
        content_type: "test",
        content_key: "test-focus-rhythm"
      },
      start_date: "2026-02-01",
      end_date: "2026-02-10"
    });

    expect(mocks.query).toHaveBeenCalledTimes(1);
    const [sql] = mocks.query.mock.calls[0] as [string, unknown[]];

    expect(sql).toContain("purchase_dim AS (");
    expect(sql).not.toContain("sp.created_utc::date >= $1::date");
    expect(sql).not.toContain("sp.created_utc::date <= $2::date");
    expect(sql).toMatch(
      /FROM purchase_dim pd\s+WHERE pd\.date >= \$1::date\s+AND pd\.date <= \$2::date/
    );
  });
});
