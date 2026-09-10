import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "fr.monpetitvoyageur.app",
  appName: "Mon Petit Voyageur",
  webDir: "dist",
  plugins: {
    CapacitorHttp: { enabled: true }
  }
};

export default config;
