import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const apiPort = Number(process.env.IGT_DEV_API_PORT || 18964);
const apiTarget = `http://127.0.0.1:${apiPort}`;

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: Number(process.env.IGT_WEB_PORT || 5173), proxy: { "/dashboard": apiTarget, "/grammar": apiTarget, "/translation": apiTarget, "/runtime": apiTarget, "/coach": apiTarget, "/review": apiTarget, "/ask": apiTarget, "/word": apiTarget, "/practice": apiTarget, "/handbook": apiTarget, "/settings": apiTarget, "/tts": apiTarget } },
});
