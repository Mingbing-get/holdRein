// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./config/env", () => ({
  getAppEnv: () => ({
    apiBaseUrl: "http://localhost:4000"
  })
}));

import App from "./App";

describe("App", () => {
  it("renders the api base url", () => {
    render(<App />);

    expect(screen.getByText(/API Base URL:/).textContent).toContain(
      "http://localhost:4000"
    );
  });
});
