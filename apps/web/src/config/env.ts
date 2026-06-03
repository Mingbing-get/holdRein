export type AppEnv = {
  apiBaseUrl: string;
};

const DEFAULT_API_BASE_URL = "";

export function getAppEnv(env: ImportMetaEnv = import.meta.env): AppEnv {
  return {
    apiBaseUrl: env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
  };
}
