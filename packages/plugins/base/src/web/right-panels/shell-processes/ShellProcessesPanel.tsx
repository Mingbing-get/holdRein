import {
  DownOutlined,
  RightOutlined,
  StopOutlined,
  SyncOutlined
} from "@ant-design/icons";
import { Button, Empty, Space, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { WebPlugin } from "@hold-rein/plugin-web";
import { BASE_EXAMPLE_PLUGIN_ID } from '../../../plugin-id'

import "./shell-processes.css";

type ShellProcessStatus = "running" | "completed" | "failed" | "killed";

interface ShellProcessRecord {
  readonly command: string;
  readonly cwd: string;
  readonly endedAt?: string;
  readonly exitCode?: number;
  readonly id: string;
  readonly startedAt: string;
  readonly status: ShellProcessStatus;
  readonly stderr: string;
  readonly stdout: string;
  readonly taskId?: string;
  readonly toolCallId: string;
  readonly truncated: boolean;
}

type ShellProcessEvent =
  | {
    readonly record: ShellProcessRecord;
    readonly type: "shell_end" | "shell_start";
  }
  | {
    readonly chunk: string;
    readonly record: ShellProcessRecord;
    readonly type: "shell_stderr" | "shell_stdout";
  };

export interface ShellProcessesPanelProps extends WebPlugin.RightPanelProps {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function ShellProcessesPanel({
  request,
  taskId
}: ShellProcessesPanelProps) {
  const [items, setItems] = useState<ShellProcessRecord[]>([]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [reconnectIndex, setReconnectIndex] = useState(0);
  const [stoppingId, setStoppingId] = useState<string>("");

  const reconnect = useCallback(() => {
    setReconnectIndex((current) => current + 1);
  }, []);

  useEffect(() => {
    if (!taskId) {
      setItems([]);
      return undefined;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setItems([]);
    void listenForShells(taskId, controller.signal, () => {
      if (active) {
        setLoading(false);
      }
    }, (event) => {
      if (!active) {
        return;
      }

      setItems((current) => applyShellEvent(current, event));
    }).finally(() => {
      if (active) {
        setLoading(false);
      }
    });

    return () => {
      active = false;
      controller.abort();
    };
  }, [reconnectIndex, taskId]);

  const stopShell = useCallback(
    async (shellId: string) => {
      setStoppingId(shellId);
      try {
        await request({
          method: "POST",
          path: `/plugin/${BASE_EXAMPLE_PLUGIN_ID}/shells/${shellId}/kill`
        });
      } finally {
        setStoppingId("");
      }
    },
    [request]
  );

  const toggleShell = useCallback((shellId: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);

      if (next.has(shellId)) {
        next.delete(shellId);
      } else {
        next.add(shellId);
      }

      return next;
    });
  }, []);

  if (!taskId) {
    return (
      <div className="shell-processes-empty">
        <Empty description="No task selected" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  return (
    <div className="shell-processes-panel">
      <div className="shell-processes-toolbar">
        <span className="shell-processes-title">Shells</span>
        <Tooltip title="Refresh">
          <Button
            aria-label="Refresh shells"
            icon={<SyncOutlined spin={loading} />}
            onClick={() => {
              reconnect();
            }}
            size="small"
            type="text"
          />
        </Tooltip>
      </div>
      {items.length === 0 ? (
        <div className="shell-processes-empty">
          <Empty description="No shell commands" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : (
        <div className="shell-processes-list">
          {items.map((item) => {
            const isExpanded = item.status === "running" || expandedIds.has(item.id);

            return (
              <article className="shell-processes-item" key={item.id}>
                <div className="shell-processes-item-header">
                  <button
                    aria-expanded={isExpanded}
                    className="shell-processes-item-title"
                    onClick={() => {
                      toggleShell(item.id);
                    }}
                    type="button"
                  >
                    {isExpanded ? <DownOutlined /> : <RightOutlined />}
                    <code className="shell-processes-command">{item.command}</code>
                  </button>
                  <Space size={4}>
                    <Tag className="shell-processes-status">{item.status}</Tag>
                    {item.status === "running" ? (
                      <Tooltip title="Stop">
                        <Button
                          aria-label="Stop shell"
                          danger
                          icon={<StopOutlined />}
                          loading={stoppingId === item.id}
                          onClick={() => {
                            void stopShell(item.id);
                          }}
                          size="small"
                          type="text"
                        />
                      </Tooltip>
                    ) : null}
                  </Space>
                </div>
                {isExpanded ? (
                  <>
                    <div className="shell-processes-meta">{item.cwd}</div>
                    <pre className="shell-processes-output">
                      {formatOutput(item)}
                    </pre>
                  </>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatOutput(item: ShellProcessRecord): string {
  const output = createOutputText(item);

  return output.trim() || "(no output)";
}

async function listenForShells(
  taskId: string,
  signal: AbortSignal,
  onOpen: () => void,
  onEvent: (event: ShellProcessEvent) => void
): Promise<void> {
  try {
    const response = await fetch(createShellStreamUrl(taskId), { signal });
    const reader = response.body?.getReader();
    onOpen();

    if (!response.ok || !reader) {
      return;
    }

    await readJsonLines(reader, signal, onEvent);
  } catch (error) {
    if (!isAbortError(error)) {
      throw error;
    }
  }
}

async function readJsonLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  signal: AbortSignal,
  onEvent: (event: ShellProcessEvent) => void
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (!signal.aborted) {
    const result = await reader.read();

    if (result.done) {
      break;
    }

    buffer += decoder.decode(result.value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) {
        continue;
      }

      onEvent(JSON.parse(line) as ShellProcessEvent);
    }
  }
}

function applyShellEvent(
  current: readonly ShellProcessRecord[],
  event: ShellProcessEvent
): ShellProcessRecord[] {
  const next = event.record;
  const index = current.findIndex((item) => item.id === next.id);

  if (index === -1) {
    return sortShellProcesses([...current, next]);
  }

  return sortShellProcesses(
    current.map((item, itemIndex) => itemIndex === index ? next : item)
  );
}

function createOutputText(record: ShellProcessRecord): string {
  return [record.stdout, record.stderr].filter(Boolean).join("");
}

function sortShellProcesses(
  items: readonly ShellProcessRecord[]
): ShellProcessRecord[] {
  return [...items].sort((left, right) => (
    Date.parse(right.startedAt) - Date.parse(left.startedAt)
  ));
}

function createShellStreamUrl(taskId: string): string {
  return `/plugin/${BASE_EXAMPLE_PLUGIN_ID}/shells?taskId=${encodeURIComponent(taskId)}`;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
