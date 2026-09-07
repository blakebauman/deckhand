import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;
const repoRoot = path.resolve(__dirname, "..");

if (repoRoot.includes("deckhand copy") || repoRoot.includes("deckhand-copy")) {
  throw new Error(`Refusing to start Vite from copy tree: ${repoRoot}`);
}

export default defineConfig({
  plugins: [tailwindcss(), react()],
  clearScreen: false,
  // Pin root so a sibling "deckhand copy" cannot steal resolution.
  root: path.resolve(__dirname),
  publicDir: path.resolve(__dirname, "../app/public"),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "../app/src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    fs: {
      allow: [repoRoot],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2022"],
    cssMinify: "lightningcss",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
  },
});
