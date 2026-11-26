import { defineConfig } from "vite";
export default defineConfig({
  build: {
    outDir: "html-preview",
    emptyOutDir: false,
    lib: {
      entry: "src/main.ts",
      name: "Cascade",
      formats: ["iife"],
      fileName: () => "cascade.js",
    },
    sourcemap: false,
  },
});
