import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_PROXY_TARGET = "http://localhost:3001";
const API_PROXY_TIMEOUT_MS = 600_000;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const apiProxyTarget =
    env.VITE_API_PROXY_TARGET ||
    env.VITE_API_BASE_URL ||
    DEFAULT_API_PROXY_TARGET;

  return {
    plugins: [],
    server: {
      proxy: {
        "/api": {
          changeOrigin: true,
          proxyTimeout: API_PROXY_TIMEOUT_MS,
          timeout: API_PROXY_TIMEOUT_MS,
          target: apiProxyTarget
        },
        "/plugin": {
          changeOrigin: true,
          proxyTimeout: API_PROXY_TIMEOUT_MS,
          timeout: API_PROXY_TIMEOUT_MS,
          target: apiProxyTarget
        }
      }
    }
  };
});
