import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import macros from "unplugin-parcel-macros";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import path from "node:path";

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    macros.vite(),
    react(),
    {
      ...optimizeLocales.vite({ locales: ["en-US"] }),
      enforce: "pre",
    },
  ],
  clearScreen: false,
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
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    target: ["es2022"],
    cssMinify: "lightningcss",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/macro-(.*)\.css$/.test(id) || /@react-spectrum\/s2\/.*\.css$/.test(id)) {
            return "s2-styles";
          }
        },
      },
    },
  },
});
