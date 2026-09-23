import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  root: "apps/web",
  build: { outDir: "dist", emptyOutDir: true },
  server: { host: "127.0.0.1", port: 5173, proxy: { "/dashboard": "http://127.0.0.1:18964", "/grammar": "http://127.0.0.1:18964", "/translation": "http://127.0.0.1:18964", "/runtime": "http://127.0.0.1:18964", "/coach": "http://127.0.0.1:18964", "/review": "http://127.0.0.1:18964", "/ask": "http://127.0.0.1:18964", "/word": "http://127.0.0.1:18964", "/practice": "http://127.0.0.1:18964", "/handbook": "http://127.0.0.1:18964" } },
});
