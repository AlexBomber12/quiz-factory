import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@/lib": path.resolve(__dirname, "src/lib"),
      "@/components": path.resolve(__dirname, "src/components"),
      "@/app": path.resolve(__dirname, "src/app"),
      "@/studio": path.resolve(__dirname, "src/studio")
    }
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"]
  }
});
