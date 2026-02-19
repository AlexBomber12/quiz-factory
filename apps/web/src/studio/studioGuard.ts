import { env } from "@/lib/env";
import { notFound } from "next/navigation";

export function enforceStudioEnabled() {
  if (env.STUDIO_ENABLED !== "true") {
    notFound();
  }
}
