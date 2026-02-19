import { env } from "@/lib/env";
import { NextResponse } from "next/server";

import { runAlertRules } from "@/lib/alerts/engine";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

const normalizeNonEmptyString = (value: unknown): string | null => {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const isAuthorizedRunner = (request: Request): boolean => {
  const expectedSecret = normalizeNonEmptyString(env.ALERTS_RUNNER_SECRET);
  const providedSecret = normalizeNonEmptyString(
    request.headers.get("x-alerts-runner-secret")
  );

  if (!expectedSecret || !providedSecret) {
    return false;
  }

  return providedSecret === expectedSecret;
};

const parseDryRun = (value: string | null): boolean => {
  if (!value) {
    return false;
  }

  return TRUE_VALUES.has(value.trim().toLowerCase());
};

export const POST = async (request: Request): Promise<Response> => {
  if (!isAuthorizedRunner(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const searchParams = new URL(request.url).searchParams;
  const ruleId = normalizeNonEmptyString(searchParams.get("rule_id"));
  const dryRun = parseDryRun(searchParams.get("dry_run"));

  try {
    const result = await runAlertRules({
      rule_id: ruleId,
      dry_run: dryRun
    });

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        error: "internal_error"
      },
      { status: 500 }
    );
  }
};
