import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["Src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["Src/**/*.ts"],
      exclude: ["Src/**/*.test.ts", "Src/server.ts", "Src/scripts/**"],
    },
  },
});
