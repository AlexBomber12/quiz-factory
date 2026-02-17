export type TenantsSource = "file" | "db";

export const getTenantsSource = (): TenantsSource => {
  const rawSource = process.env.TENANTS_SOURCE;
  if (!rawSource) {
    return "file";
  }

  return rawSource.trim().toLowerCase() === "db" ? "db" : "file";
};
