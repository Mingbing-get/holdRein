export interface HealthStatus {
  service: "api";
  status: "ok";
  version: "v1";
}

export function getHealthStatus(): HealthStatus {
  return {
    service: "api",
    status: "ok",
    version: "v1"
  };
}
