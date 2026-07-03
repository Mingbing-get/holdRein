import {
  BranchesOutlined,
  DownOutlined,
  FileTextOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import type { WebPlugin } from "@hold-rein/plugin-web";
import {
  Alert,
  Button,
  Dropdown,
  Empty,
  Input,
  Modal,
  Space,
  Spin,
  Typography
} from "antd";
import {
  type ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";

import { PLUGIN_ID } from "../../plugin-id";
import type { GitRepositoryStatus } from "./types";

import "./git-panel.css";

const JSON_HEADERS = { "Content-Type": "application/json" };

export interface GitPanelProps extends WebPlugin.RightPanelProps {
  readonly request: WebPlugin.RuntimeContext["request"];
}

export function GitPanel(
  { request, workspacePath }: GitPanelProps
): ReactElement {
  const [repository, setRepository] = useState<GitRepositoryStatus>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState("");
  const [changesOpen, setChangesOpen] = useState(false);
  const [commitOpen, setCommitOpen] = useState(false);
  const [message, setMessage] = useState("");

  const refresh = useCallback(async () => {
    if (!workspacePath) return;
    setLoading(true);
    setError("");
    try {
      const result = await request<GitRepositoryStatus>({
        method: "GET",
        path: `/plugin/${PLUGIN_ID}/status`,
        query: { workspacePath }
      });
      setRepository(result.data);
    } catch (nextError) {
      setError(readError(nextError));
    } finally {
      setLoading(false);
    }
  }, [request, workspacePath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const mutate = useCallback(async (
    name: string,
    path: string,
    body: Record<string, unknown>
  ) => {
    setOperation(name);
    setError("");
    try {
      await request({
        method: "POST",
        path: `/plugin/${PLUGIN_ID}${path}`,
        body: JSON.stringify(body),
        headers: JSON_HEADERS
      });
      await refresh();
      return true;
    } catch (nextError) {
      setError(readError(nextError));
      return false;
    } finally {
      setOperation("");
    }
  }, [refresh, request]);

  const branchItems = useMemo(() => repository?.initialized
    ? repository.branches
      .filter((branch) => branch !== repository.currentBranch)
      .map((branch) => ({
        disabled: repository.hasChanges,
        key: branch,
        label: branch,
        onClick: () => void mutate("branch", "/branches/switch", {
          workspacePath,
          branch
        })
      }))
    : [], [mutate, repository, workspacePath]);

  if (!workspacePath) {
    return <Empty className="git-panel__empty" description="No workspace selected" />;
  }

  if (loading && !repository) {
    return <div className="git-panel__empty"><Spin /></div>;
  }

  if (!repository) {
    return (
      <div className="git-panel">
        {error ? <Alert message={error} showIcon type="error" /> : null}
        <Button onClick={() => void refresh()}>Retry</Button>
      </div>
    );
  }

  if (!repository.initialized) {
    return (
      <div className="git-panel">
        {error ? <Alert message={error} showIcon type="error" /> : null}
        <Empty description="Git is not initialized">
          <Button
            loading={operation === "initialize"}
            onClick={() => void mutate("initialize", "/initialize", { workspacePath })}
            type="primary"
          >
            Initialize Git
          </Button>
        </Empty>
      </div>
    );
  }

  const submitCommit = async (push: boolean) => {
    const succeeded = await mutate("commit", "/commits", {
      workspacePath,
      message: message.trim(),
      push
    });
    if (succeeded) {
      setCommitOpen(false);
      setMessage("");
    }
  };

  return (
    <div className="git-panel">
      <div className="git-panel__header">
        <Typography.Text strong>Repository</Typography.Text>
        <Button
          aria-label="Refresh Git status"
          icon={<ReloadOutlined />}
          loading={loading}
          onClick={() => void refresh()}
          size="small"
          type="text"
        />
      </div>
      {error ? <Alert closable message={error} showIcon type="error" /> : null}
      <div className="git-panel__section git-panel__row">
        <Space><BranchesOutlined />分支</Space>
        <Dropdown menu={{ items: branchItems }} trigger={["hover", "click"]}>
          <Button aria-label={`当前分支 ${repository.currentBranch}`} type="text">
            {repository.currentBranch || "No commits"} <DownOutlined />
          </Button>
        </Dropdown>
      </div>
      <div className="git-panel__section">
        <button
          aria-expanded={changesOpen}
          aria-label={`变更 +${repository.additions} -${repository.deletions}`}
          className="git-panel__row"
          disabled={!repository.hasChanges}
          onClick={() => setChangesOpen((current) => !current)}
          type="button"
        >
          <Space><FileTextOutlined />变更</Space>
          <span>
            <span className="git-panel__additions">+{repository.additions}</span>{" "}
            <span className="git-panel__deletions">-{repository.deletions}</span>
          </span>
        </button>
        {changesOpen ? (
          <ul className="git-panel__files">
            {repository.files.map((file) => <li key={file}>{file}</li>)}
          </ul>
        ) : null}
      </div>
      <Button
        disabled={!repository.hasChanges}
        onClick={() => setCommitOpen(true)}
        type="primary"
      >
        提交变更
      </Button>
      <Modal
        destroyOnHidden
        footer={(
          <Space>
            <Button autoInsertSpace={false} onClick={() => setCommitOpen(false)}>取消</Button>
            <Button
              autoInsertSpace={false}
              disabled={!message.trim()}
              loading={operation === "commit"}
              onClick={() => void submitCommit(false)}
            >提交</Button>
            <Button
              disabled={!message.trim()}
              loading={operation === "commit"}
              onClick={() => void submitCommit(true)}
              type="primary"
            >提交并推送</Button>
          </Space>
        )}
        onCancel={() => setCommitOpen(false)}
        open={commitOpen}
        title="提交变更"
      >
        <Input.TextArea
          autoFocus
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Commit message"
          rows={4}
          value={message}
        />
      </Modal>
    </div>
  );
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Git operation failed";
}
