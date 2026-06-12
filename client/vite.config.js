import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:4000";
var vite_config_default = defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true
      }
    }
  }
});
export {
  vite_config_default as default
};
