import { env } from "@/lib/env";
import { NextResponse } from "next/server";

const normalizeEnv = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const GET = async (): Promise<Response> => {
  const commitSha = normalizeEnv(env.COMMIT_SHA);
  const payload: Record<string, string> = {
    status: "ok",
    server_time: new Date().toISOString()
  };

  if (commitSha) {
    payload.commit_sha = commitSha;
  }

  return NextResponse.json(payload);
};

