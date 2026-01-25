import { afterEach, describe, expect, it } from "vitest";

import { GET } from "./route";

const originalCommitSha = process.env.COMMIT_SHA;

const restoreCommitSha = (): void => {
  if (originalCommitSha === undefined) {
    delete process.env.COMMIT_SHA;
    return;
  }

  process.env.COMMIT_SHA = originalCommitSha;
};

describe("GET /api/health", () => {
  afterEach(() => {
    restoreCommitSha();
  });

  it("returns ok with server time", async () => {
    delete process.env.COMMIT_SHA;

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.status).toBe("ok");
    expect(typeof payload.server_time).toBe("string");
    expect(Number.isNaN(Date.parse(String(payload.server_time)))).toBe(false);
    expect(payload).not.toHaveProperty("commit_sha");
  });

  it("includes commit sha when provided", async () => {
    process.env.COMMIT_SHA = "abc123";

    const response = await GET();
    expect(response.status).toBe(200);

    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.commit_sha).toBe("abc123");
  });
});

