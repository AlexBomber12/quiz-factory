import { env } from "@/lib/env";

export type TenantsSource = "file" | "db";

export const getTenantsSource = (): TenantsSource => {
  const rawSource = env.TENANTS_SOURCE;
  if (!rawSource) {
    return "file";
  }

  return rawSource.trim().toLowerCase() === "db" ? "db" : "file";
};
