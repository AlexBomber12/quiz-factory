import { notFound } from "next/navigation";

export function enforceStudioEnabled() {
  if (process.env.STUDIO_ENABLED !== "true") {
    notFound();
  }
}
