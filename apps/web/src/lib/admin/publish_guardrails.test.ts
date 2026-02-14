import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  getContentDbPool: vi.fn(),
  listTenantRegistry: vi.fn(),
  validateTestSpec: vi.fn()
}));

vi.mock("../content_db/pool", () => ({
  getContentDbPool: mocks.getContentDbPool
}));

vi.mock("./publish", () => ({
  listTenantRegistry: mocks.listTenantRegistry
}));

vi.mock("../content/validate", () => ({
  validateTestSpec: (...args: unknown[]) => mocks.validateTestSpec(...args)
}));

import {
  PublishGuardrailValidationError,
  validatePublishGuardrails
} from "./publish_guardrails";

const VALIDATED_SPEC_BASE = {
  test_id: "test-focus-rhythm",
  slug: "focus-rhythm",
  version: 1,
  category: "productivity",
  questions: [],
  scoring: {
    scales: [],
    option_weights: {}
  },
  result_bands: []
};

describe("validatePublishGuardrails", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getContentDbPool.mockReturnValue({
      query: mocks.query
    });
    mocks.listTenantRegistry.mockReturnValue([
      {
        tenant_id: "tenant-tenant-example-com",
        domains: [],
        default_locale: "en"
      }
    ]);
    mocks.query.mockResolvedValue({
      rows: [
        {
          test_id: "test-focus-rhythm",
          spec_json: {}
        }
      ]
    });
  });

  it("skips spec validation for disable-only operations", async () => {
    mocks.validateTestSpec.mockImplementation(() => {
      throw new Error("invalid spec");
    });

    await expect(
      validatePublishGuardrails({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: false
      })
    ).resolves.toBeUndefined();

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.validateTestSpec).not.toHaveBeenCalled();
  });

  it("enforces spec validation for enable operations", async () => {
    mocks.validateTestSpec.mockReturnValue({
      ...VALIDATED_SPEC_BASE,
      locales: {
        en: {
          title: "Focus Rhythm",
          short_description: "desc",
          intro: "intro",
          paywall_headline: "headline",
          report_title: "report"
        }
      }
    });

    await expect(
      validatePublishGuardrails({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
      })
    ).resolves.toBeUndefined();

    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.validateTestSpec).toHaveBeenCalledTimes(1);
  });

  it("fails enable operations when locales.en is missing", async () => {
    mocks.validateTestSpec.mockReturnValue({
      ...VALIDATED_SPEC_BASE,
      locales: {
        es: {
          title: "Ritmo de enfoque",
          short_description: "desc",
          intro: "intro",
          paywall_headline: "headline",
          report_title: "report"
        }
      }
    });

    await expect(
      validatePublishGuardrails({
        test_id: "test-focus-rhythm",
        version_id: "version-1",
        tenant_ids: ["tenant-tenant-example-com"],
        is_enabled: true
      })
    ).rejects.toBeInstanceOf(PublishGuardrailValidationError);
  });
});
