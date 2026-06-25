import { getAppEnv } from "./config/env";
import { AppUiProvider } from "./app/app-ui-context";
import { AppWorkspaceProvider } from "./app/app-workspace-context";
import { AppPluginProvider } from "./app/app-plugin";
import { HoldReinShell } from "./modules/shell/hold-rein-shell";
import { AgentTasksProvider } from "./modules/agent-messages";

export default function App() {
  const { apiBaseUrl } = getAppEnv();

  return (
    <AppUiProvider>
      <AppWorkspaceProvider>
        <AppPluginProvider>
          <AgentTasksProvider apiBaseUrl={apiBaseUrl}>
            <HoldReinShell apiBaseUrl={apiBaseUrl} />
          </AgentTasksProvider>
        </AppPluginProvider>
      </AppWorkspaceProvider>
    </AppUiProvider>
  );
}
