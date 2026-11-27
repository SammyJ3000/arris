import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["specs/**/*.test.ts"],
    globalSetup: ["./helpers/global-setup.ts"],
    // Files run one after another: they share the practice project, and the
    // job number test needs nobody else creating jobs at the same moment.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
