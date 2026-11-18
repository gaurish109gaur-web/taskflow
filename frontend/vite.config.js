import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/three/")) return "three-vendor";
          if (id.includes("/node_modules/recharts/") || /\/node_modules\/(d3-[^/]+|victory-vendor)\//.test(id)) return "charts-vendor";
          return undefined;
        },
      },
    },
  },
});
