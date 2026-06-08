import { getAppEnv } from "./config/env";
import { AppUiProvider } from "./app/app-ui-context";
import { AppWorkspaceProvider } from "./app/app-workspace-context";
import { HoldReinShell } from "./modules/shell/hold-rein-shell";
import { AgentTasksProvider } from "./modules/agent-messages";

export default function App() {
  const { apiBaseUrl } = getAppEnv();

  return (
    <AppUiProvider>
      <AppWorkspaceProvider>
        <AgentTasksProvider apiBaseUrl={apiBaseUrl}>
          <HoldReinShell apiBaseUrl={apiBaseUrl} />
        </AgentTasksProvider>
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}
