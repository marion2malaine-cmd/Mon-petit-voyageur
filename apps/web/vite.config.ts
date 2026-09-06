import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The single .env at the repo root serves both apps; only VITE_* and the
  // Mapbox public token (a pk. token is meant to ship to browsers) reach the
  // client bundle.
  envDir: "../..",
  envPrefix: ["VITE_", "MAPBOX_ACCESS_TOKEN"],
  server: {
    // 5173 is Vite's default, so other local projects (Tout Mon Immo) grab it
    // first and the app silently ends up on another port — or worse, the other
    // project answers on 5173. strictPort makes a collision fail loudly.
    port: 5180,
    strictPort: true
  }
});
