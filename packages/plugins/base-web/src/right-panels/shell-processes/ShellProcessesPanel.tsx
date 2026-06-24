import { StopOutlined, SyncOutlined } from "@ant-design/icons";
import { Button, Empty, Space, Tag, Tooltip } from "antd";
import { useCallback, useEffect, useState } from "react";
import type { WebPlugin } from "@hold-rein/plugin-web";

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

export interface ShellProcessesPanelProps extends WebPlugin.RightPanelProps {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function ShellProcessesPanel({
  request,
  status,
  taskId
}: ShellProcessesPanelProps) {
  const [items, setItems] = useState<ShellProcessRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [stoppingId, setStoppingId] = useState<string>("");

  const loadShells = useCallback(async () => {
    if (!taskId) {
      setItems([]);
      return;
    }

    setLoading(true);
    try {
      const result = await request<ShellProcessRecord[]>({
        path: "/plugin/__base/shells",
        query: { taskId }
      });
      setItems(result.data);
    } finally {
      setLoading(false);
    }
  }, [request, taskId]);

  useEffect(() => {
    void loadShells();
  }, [loadShells]);

  useEffect(() => {
    if (!taskId || status !== "running") {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadShells();
    }, 2_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadShells, status, taskId]);

  const stopShell = useCallback(
    async (shellId: string) => {
      setStoppingId(shellId);
      try {
        await request({
          method: "POST",
          path: `/plugin/__base/shells/${shellId}/kill`
        });
        await loadShells();
      } finally {
        setStoppingId("");
      }
    },
    [loadShells, request]
  );

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
              void loadShells();
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
          {items.map((item) => (
            <article className="shell-processes-item" key={item.id}>
              <div className="shell-processes-item-header">
                <code className="shell-processes-command">{item.command}</code>
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
              <div className="shell-processes-meta">{item.cwd}</div>
              <pre className="shell-processes-output">
                {formatOutput(item)}
              </pre>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function formatOutput(item: ShellProcessRecord): string {
  const output = item.stdout || item.stderr;

  return output.trim() || "(no output)";
}
