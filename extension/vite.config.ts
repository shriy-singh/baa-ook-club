import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const root = path.resolve(__dirname, "..");

// Builds the extension pages; extension/build.mjs then adds assets and a manifest per browser.
export default defineConfig({
  root: __dirname,
  base: "./",
  plugins: [react()],
  publicDir: false,
  resolve: { alias: { "@": root } },
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    outDir: path.join(root, "dist-extension", "pages"),
    emptyOutDir: true,
    // Extension pages may not run inline scripts, so keep everything in files.
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: { index: path.join(__dirname, "index.html"), popup: path.join(__dirname, "popup.html") },
    },
  },
});
