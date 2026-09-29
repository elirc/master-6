import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@lms/domain": fileURLToPath(new URL("../../packages/domain/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "node"
  }
});
