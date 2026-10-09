import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// `npm run dev` proxies /api to the gateway and /osrm to the public OSRM server,
// so the dev server behaves exactly like the nginx container.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  server: {
    port: 5173,
    proxy: {
      "/api": { target: process.env.VITE_GATEWAY_URL ?? "http://localhost:8080", changeOrigin: true },
      "/osrm": {
        target: "https://router.project-osrm.org",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/osrm/, ""),
      },
    },
  },
});
