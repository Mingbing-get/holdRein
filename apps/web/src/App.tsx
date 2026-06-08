import { getAppEnv } from "./config/env";
import { AppUiProvider } from "./app/app-ui-context";
import { AppWorkspaceProvider } from "./app/app-workspace-context";
import { HoldReinShell } from "./modules/shell/hold-rein-shell";

export default function App() {
  const { apiBaseUrl } = getAppEnv();

  return (
    <AppUiProvider>
      <AppWorkspaceProvider>
        <HoldReinShell apiBaseUrl={apiBaseUrl} />
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}
