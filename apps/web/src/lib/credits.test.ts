import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  CREDITS_COOKIE,
  CONSUMED_REPORTS_MAX,
  consumeCreditForReport,
  createReportKey,
  grantCredits,
  parseCreditsCookie,
  setLastGrantMetadata,
  serializeCreditsCookie
} from "./credits";

const TENANT_ID = "tenant-example";

const parseFromCookie = (cookieValue: string) =>
  parseCreditsCookie({ [CREDITS_COOKIE]: cookieValue }, TENANT_ID);

describe("credits cookie", () => {
  beforeEach(() => {
    process.env.REPORT_TOKEN_SECRET = "test-report-token-secret";
  });

  afterEach(() => {
    delete process.env.REPORT_TOKEN_SECRET;
  });

  it("grants credits and is idempotent per grant id", () => {
    const emptyState = parseCreditsCookie({}, TENANT_ID);

    const grantedOnce = grantCredits(emptyState, 5, "purchase-1");
    const grantedTwice = grantCredits(grantedOnce, 5, "purchase-1");

    expect(grantedOnce.credits_remaining).toBe(5);
    expect(grantedTwice.credits_remaining).toBe(5);
    expect(grantedTwice.grant_ids).toEqual(["purchase-1"]);
  });

  it("consumes a credit once per report key", () => {
    const emptyState = parseCreditsCookie({}, TENANT_ID);
    const granted = grantCredits(emptyState, 2, "purchase-2");
    const reportKey = createReportKey(TENANT_ID, "test-focus", "session-1");

    const firstConsume = consumeCreditForReport(granted, reportKey);
    const secondConsume = consumeCreditForReport(firstConsume.new_state, reportKey);

    expect(firstConsume.consumed).toBe(true);
    expect(firstConsume.new_state.credits_remaining).toBe(1);
    expect(firstConsume.new_state.consumed_report_keys).toContain(reportKey);

    expect(secondConsume.consumed).toBe(false);
    expect(secondConsume.new_state.credits_remaining).toBe(1);
  });

  it("does not consume when no credits remain", () => {
    const emptyState = parseCreditsCookie({}, TENANT_ID);
    const reportKey = createReportKey(TENANT_ID, "test-focus", "session-2");

    const result = consumeCreditForReport(emptyState, reportKey);

    expect(result.consumed).toBe(false);
    expect(result.new_state.credits_remaining).toBe(0);
    expect(result.new_state.consumed_report_keys).toEqual([]);
  });

  it("caps consumed report keys to the most recent entries", () => {
    const totalReports = CONSUMED_REPORTS_MAX + 5;
    let state = grantCredits(parseCreditsCookie({}, TENANT_ID), totalReports, "purchase-cap");
    const keys = Array.from({ length: totalReports }, (_, index) =>
      createReportKey(TENANT_ID, `test-${index}`, `session-${index}`)
    );

    for (const key of keys) {
      state = consumeCreditForReport(state, key).new_state;
    }

    const expectedKeys = keys.slice(-CONSUMED_REPORTS_MAX).reverse();
    expect(state.consumed_report_keys).toEqual(expectedKeys);
    expect(state.consumed_report_keys).toHaveLength(CONSUMED_REPORTS_MAX);
    expect(state.credits_remaining).toBe(0);
  });

  it("round-trips through cookie serialization", () => {
    const emptyState = parseCreditsCookie({}, TENANT_ID);
    const granted = grantCredits(emptyState, 3, "purchase-rt");
    const reportKey = createReportKey(TENANT_ID, "test-rt", "session-rt");
    const consumed = consumeCreditForReport(granted, reportKey).new_state;

    const parsed = parseFromCookie(serializeCreditsCookie(consumed));
    expect(parsed.credits_remaining).toBe(consumed.credits_remaining);
    expect(parsed.consumed_report_keys).toEqual(consumed.consumed_report_keys);
    expect(parsed.grant_ids).toEqual(consumed.grant_ids);
  });

  it("stores last grant metadata for later report tokens", () => {
    const granted = grantCredits(parseCreditsCookie({}, TENANT_ID), 5, "purchase-meta");
    const withMetadata = setLastGrantMetadata(granted, {
      grant_id: "purchase-meta",
      offer_key: "pack5",
      product_type: "pack_5",
      pricing_variant: "base"
    });

    const parsed = parseFromCookie(serializeCreditsCookie(withMetadata));
    expect(parsed.last_grant).toEqual({
      grant_id: "purchase-meta",
      offer_key: "pack5",
      product_type: "pack_5",
      pricing_variant: "base"
    });
  });
});
