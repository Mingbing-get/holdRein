// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { CronExpressionInput } from ".";

class ResizeObserverMock {
  disconnect() {
    return undefined;
  }
  observe() {
    return undefined;
  }
  unobserve() {
    return undefined;
  }
}

beforeAll(() => vi.stubGlobal("ResizeObserver", ResizeObserverMock));
afterEach(cleanup);

describe("CronExpressionInput", () => {
  it("renders a translated read-only value and an empty placeholder", () => {
    const { rerender } = render(<CronExpressionInput value="*/15 * * * *" />);
    const input = screen.getByRole("textbox", { name: "执行周期" });
    expect(input).toHaveValue("每隔 15 分钟");
    expect(input).toHaveAttribute("readonly");

    rerender(<CronExpressionInput value="" />);
    expect(input).toHaveAttribute("placeholder", "请选择执行周期");
  });

  it("shows a stable fallback for unsupported values", () => {
    render(<CronExpressionInput value="not cron" />);
    expect(screen.getByRole("textbox", { name: "执行周期" })).toHaveValue(
      "无法识别的执行周期"
    );
  });

  it("keeps edits as a draft until confirmation", async () => {
    const onChange = vi.fn();
    render(<CronExpressionInput onChange={onChange} value="* * * * *" />);
    fireEvent.click(screen.getByRole("textbox", { name: "执行周期" }));
    fireEvent.click(await screen.findByRole("button", { name: "05" }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /确\s*定/ }));
    expect(onChange).toHaveBeenCalledWith("5 * * * *");
  });

  it("discards the draft when canceled or dismissed", async () => {
    const onChange = vi.fn();
    render(<CronExpressionInput onChange={onChange} value="* * * * *" />);
    const input = screen.getByRole("textbox", { name: "执行周期" });
    fireEvent.click(input);
    fireEvent.click(await screen.findByRole("button", { name: "05" }));
    fireEvent.click(screen.getByRole("button", { name: /取\s*消/ }));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(input);
    fireEvent.click(await screen.findByRole("button", { name: "10" }));
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(input.closest(".ant-popover-open")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders only fields belonging to the selected frequency", async () => {
    render(<CronExpressionInput value="* * * * *" />);
    fireEvent.click(screen.getByRole("textbox", { name: "执行周期" }));
    expect(await screen.findByRole("group", { name: "分钟选择" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "小时选择" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("周", { selector: ".ant-segmented-item-label" }));
    expect(screen.getByRole("group", { name: "星期选择" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "小时选择" })).toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "日期选择" })).not.toBeInTheDocument();
  });

  it("renders the popover without an arrow", async () => {
    render(<CronExpressionInput value="* * * * *" />);
    fireEvent.click(screen.getByRole("textbox", { name: "执行周期" }));
    await screen.findByRole("group", { name: "分钟选择" });
    expect(document.querySelector(".ant-popover-arrow")).not.toBeInTheDocument();
  });

  it("expands fields by default and toggles each field independently", async () => {
    render(<CronExpressionInput value="* * * * *" />);
    fireEvent.click(screen.getByRole("textbox", { name: "执行周期" }));
    fireEvent.click(await screen.findByText("小时", { selector: ".ant-segmented-item-label" }));

    const hourHeader = screen.getByRole("button", { name: "小时折叠开关" });
    const minuteHeader = screen.getByRole("button", { name: "分钟折叠开关" });
    expect(hourHeader).toHaveAttribute("aria-expanded", "true");
    expect(minuteHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "小时选择" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "分钟选择" })).toBeInTheDocument();

    fireEvent.click(hourHeader);
    expect(hourHeader).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("group", { name: "小时选择" })).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "分钟选择" })).toBeInTheDocument();

    fireEvent.click(hourHeader);
    expect(hourHeader).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "小时选择" })).toBeInTheDocument();
  });

  it("preserves selected values while a field is collapsed", async () => {
    render(<CronExpressionInput value="* * * * *" />);
    fireEvent.click(screen.getByRole("textbox", { name: "执行周期" }));
    const minute = await screen.findByRole("button", { name: "05" });
    fireEvent.click(minute);
    fireEvent.click(screen.getByRole("button", { name: "分钟折叠开关" }));
    expect(screen.queryByRole("button", { name: "05" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "分钟折叠开关" }));
    expect(screen.getByRole("button", { name: "05" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("exposes pressed state, disabled state, status, and blur", async () => {
    const onBlur = vi.fn();
    const { rerender } = render(
      <CronExpressionInput onBlur={onBlur} status="warning" value="* * * * *" />
    );
    const input = screen.getByRole("textbox", { name: "执行周期" });
    expect(input.closest(".ant-input-status-warning")).toBeInTheDocument();
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledOnce();
    fireEvent.click(input);
    const minute = await screen.findByRole("button", { name: "05" });
    expect(minute).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(minute);
    expect(minute).toHaveAttribute("aria-pressed", "true");

    rerender(<CronExpressionInput disabled value="* * * * *" />);
    expect(input).toBeDisabled();
  });
});
