import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RESUME_STATE_VERSION,
  clearResumeState,
  loadResumeState,
  saveResumeState,
  type ResumeState
} from "./resume_state";

const getStorageKey = (testId: string, slug: string): string => {
  return `quiz_factory:resume_state:${testId}:${slug}`;
};

class MemoryStorage implements Storage {
  private readonly records = new Map<string, string>();

  get length(): number {
    return this.records.size;
  }

  clear(): void {
    this.records.clear();
  }

  getItem(key: string): string | null {
    return this.records.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.records.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.records.delete(key);
  }

  setItem(key: string, value: string): void {
    this.records.set(key, value);
  }
}

describe("resume state helpers", () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("roundtrips save and load", () => {
    const state: ResumeState = {
      version: RESUME_STATE_VERSION,
      test_id: "test-demo",
      slug: "demo-slug",
      session_id: "session-123",
      attempt_token: "attempt-123",
      current_index: 2,
      answers: {
        q1: "a2",
        q2: "a1"
      },
      updated_at_utc: "2026-01-01T00:00:00.000Z"
    };

    saveResumeState(state);

    expect(loadResumeState("test-demo", "demo-slug")).toEqual(state);
  });

  it("returns null for invalid payloads", () => {
    storage.setItem(
      getStorageKey("test-demo", "demo-slug"),
      JSON.stringify({
        version: RESUME_STATE_VERSION,
        test_id: "test-demo",
        slug: "demo-slug",
        session_id: "session-123",
        attempt_token: "attempt-123",
        current_index: 1,
        answers: ["invalid"],
        updated_at_utc: "2026-01-01T00:00:00.000Z"
      })
    );

    expect(loadResumeState("test-demo", "demo-slug")).toBeNull();
  });

  it("clears saved state", () => {
    const state: ResumeState = {
      version: RESUME_STATE_VERSION,
      test_id: "test-demo",
      slug: "demo-slug",
      session_id: "session-123",
      attempt_token: "attempt-123",
      current_index: 0,
      answers: {
        q1: "a2"
      },
      updated_at_utc: "2026-01-01T00:00:00.000Z"
    };

    saveResumeState(state);
    clearResumeState("test-demo", "demo-slug");

    expect(loadResumeState("test-demo", "demo-slug")).toBeNull();
    expect(storage.getItem(getStorageKey("test-demo", "demo-slug"))).toBeNull();
  });
});
