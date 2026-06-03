import { getAppEnv } from "./config/env";
import { HealthPanel } from "./modules/health";
import { AppShell } from "./shared/app-shell";

export default function App() {
  const { apiBaseUrl } = getAppEnv();

  return (
    <AppShell>
      <HealthPanel apiBaseUrl={apiBaseUrl} />
    </AppShell>
  );
}
