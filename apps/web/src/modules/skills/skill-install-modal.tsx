import { Form, Input, Modal } from "antd";

const GITHUB_ROOT_REPOSITORY_PATTERN =
  /^(?:https:\/\/github\.com\/[^/\s]+\/(?<httpsRepo>[^/\s]+?)(?:\.git)?\/?|git@github\.com:[^/\s]+\/(?<sshRepo>[^/\s]+?)(?:\.git)?)$/u;
const GITHUB_WEB_REPOSITORY_PATTERN =
  /^https:\/\/github\.com\/[^/\s]+\/(?<repo>[^/\s]+)\/(?<kind>tree|blob)\/(?<ref>[^/\s]+)(?:\/(?<path>.*))?\/?$/u;
const GITHUB_REPOSITORY_NAME_PATTERN = /^[A-Za-z0-9._-]+$/u;

export interface SkillInstallFormValues {
  repositoryUrl: string;
}

interface SkillInstallModalProps {
  confirmLoading: boolean;
  onCancel: () => void;
  onSubmit: (values: SkillInstallFormValues) => void;
  open: boolean;
}

export function SkillInstallModal({
  confirmLoading,
  onCancel,
  onSubmit,
  open
}: SkillInstallModalProps) {
  const [form] = Form.useForm<SkillInstallFormValues>();

  return (
    <Modal
      confirmLoading={confirmLoading}
      destroyOnHidden
      cancelText="取消"
      okButtonProps={{ "aria-label": "确认安装技能" }}
      okText="安装"
      onCancel={onCancel}
      onOk={() => void form.submit()}
      open={open}
      title="安装技能"
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={(values) => {
          onSubmit({ repositoryUrl: values.repositoryUrl.trim() });
        }}
      >
        <Form.Item
          label="GitHub 仓库地址"
          name="repositoryUrl"
          rules={[
            { message: "请输入 GitHub 仓库地址", required: true },
            {
              message: "请输入有效的 GitHub 仓库地址",
              validator: async (_, value: unknown) => {
                if (typeof value !== "string" || isValidGithubSkillUrl(value)) {
                  return;
                }

                throw new Error("请输入有效的 GitHub 仓库地址");
              }
            }
          ]}
        >
          <Input
            autoFocus
            placeholder="https://github.com/owner/skill-repo.git"
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}

function isValidGithubSkillUrl(value: string): boolean {
  const repositoryUrl = value.trim();
  const rootMatch = GITHUB_ROOT_REPOSITORY_PATTERN.exec(repositoryUrl);
  const rootRepo = rootMatch?.groups?.httpsRepo ?? rootMatch?.groups?.sshRepo;

  if (rootRepo) {
    return GITHUB_REPOSITORY_NAME_PATTERN.test(rootRepo);
  }

  const webMatch = GITHUB_WEB_REPOSITORY_PATTERN.exec(repositoryUrl);
  const repo = webMatch?.groups?.repo;
  const kind = webMatch?.groups?.kind;
  const path = webMatch?.groups?.path;

  if (!repo || !kind || !GITHUB_REPOSITORY_NAME_PATTERN.test(repo)) {
    return false;
  }

  const pathSegments = getGithubPathSegments(path);

  if (!pathSegments) {
    return false;
  }

  return kind === "tree" || pathSegments.at(-1) === "SKILL.md";
}

function getGithubPathSegments(path: string | undefined): string[] | null {
  if (!path) {
    return [];
  }

  const segments = path.split("/").filter((segment) => segment.length > 0);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return null;
  }

  return segments;
}
