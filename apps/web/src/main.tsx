import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "antd/dist/reset.css";

import App from "./App";

const rootElement = globalThis.document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
