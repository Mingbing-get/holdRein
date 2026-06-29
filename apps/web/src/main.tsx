import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";

import App from "./App";
import { registerRuntimePluginPackages } from "./app/runtime-require";

const rootElement = globalThis.document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

registerRuntimePluginPackages();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
