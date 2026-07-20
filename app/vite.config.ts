import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import macros from "unplugin-parcel-macros";
import optimizeLocales from "@react-aria/optimize-locales-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [
    macros.vite(),
    react(),
    {
      ...optimizeLocales.vite({ locales: ["en-US"] }),
      enforce: "pre",
    },
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 1420,
    strictPort: true,
  },
  clearScreen: false,
  build: {
    target: ["es2022"],
    cssMinify: "lightningcss",
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
