import { defineConfig, loadEnv } from "vite";

const DEFAULT_API_PROXY_TARGET = "http://localhost:3001";

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
          target: apiProxyTarget
        },
        "/plugin": {
          changeOrigin: true,
          target: apiProxyTarget
        }
      }
    }
  };
});
