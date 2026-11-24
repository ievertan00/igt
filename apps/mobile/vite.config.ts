import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Android WebView loads this build from the Local Runtime at /mobile/.
// It is emitted INSIDE apps/web/dist so the runtime serves it same-origin
// with the existing API; the desktop client keeps its own / entry point.
const apiPort = Number(process.env.IGT_DEV_API_PORT || 18964);
const apiTarget = `http://127.0.0.1:${apiPort}`;
const proxied = [
  "/status-message", "/dashboard", "/grammar", "/translation", "/runtime",
  "/coach", "/review", "/vocab", "/ask", "/word", "/practice", "/handbook",
  "/settings", "/tts", "/health",
];

export default defineConfig({
  plugins: [react()],
  root: "apps/mobile",
  base: "/mobile/",
  build: {
    outDir: "../web/dist/mobile",
    emptyOutDir: true,
    target: "es2020",
  },
  server: {
    strictPort: true,
    host: "127.0.0.1",
    port: Number(process.env.IGT_MOBILE_PORT || 5174),
    proxy: Object.fromEntries(proxied.map((prefix) => [prefix, apiTarget])),
  },
});
