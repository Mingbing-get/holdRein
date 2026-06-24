import { PlusOutlined, ToolOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Flex, Spin, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";

import { SkillCard } from "./skill-card";
import {
  fetchInstalledSkills,
  installSkill,
  setSkillDisabled,
  uninstallSkill
} from "./skill-management-api";
import {
  SkillInstallModal,
  type SkillInstallFormValues
} from "./skill-install-modal";
import type { InstalledSkill } from "./skill-management-types";

interface SkillManagementViewProps {
  apiBaseUrl: string;
}

type LoadState =
  | { status: "loading" }
  | { skills: InstalledSkill[]; status: "success" }
  | { message: string; status: "error" };

export function SkillManagementView({ apiBaseUrl }: SkillManagementViewProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [busySkillId, setBusySkillId] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshSkills = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      setLoadState({
        skills: await fetchInstalledSkills(apiBaseUrl),
        status: "success"
      });
    } catch (error) {
      setLoadState({
        message: error instanceof Error ? error.message : "Failed to load skills",
        status: "error"
      });
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshSkills();
  }, [refreshSkills]);

  const toggleSkill = async (skill: InstalledSkill, enabled: boolean) => {
    setBusySkillId(skill.id);
    setErrorMessage("");
    try {
      const updatedSkill = await setSkillDisabled(apiBaseUrl, skill.id, !enabled);
      setLoadState((currentState) =>
        currentState.status === "success"
          ? {
              skills: currentState.skills.map((currentSkill) =>
                currentSkill.id === updatedSkill.id ? updatedSkill : currentSkill
              ),
              status: "success"
            }
          : currentState
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to update skill");
    } finally {
      setBusySkillId(null);
    }
  };

  const removeSkill = async (skill: InstalledSkill) => {
    setBusySkillId(skill.id);
    setErrorMessage("");
    try {
      await uninstallSkill(apiBaseUrl, skill.id);
      setLoadState((currentState) =>
        currentState.status === "success"
          ? {
              skills: currentState.skills.filter(
                (currentSkill) => currentSkill.id !== skill.id
              ),
              status: "success"
            }
          : currentState
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to uninstall skill");
    } finally {
      setBusySkillId(null);
    }
  };

  const submitInstall = async (values: SkillInstallFormValues) => {
    setIsInstalling(true);
    setErrorMessage("");
    try {
      await installSkill(apiBaseUrl, values.repositoryUrl);
      setInstallModalOpen(false);
      await refreshSkills();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to install skill");
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Flex gap={12} style={{ minHeight: 0 }} vertical>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={10}>
          <ToolOutlined style={{ color: "var(--app-color-primary)" }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            技能管理
          </Typography.Title>
        </Flex>
        <Button
          aria-label="安装技能"
          icon={<PlusOutlined />}
          onClick={() => setInstallModalOpen(true)}
          type="primary"
        >
          安装技能
        </Button>
      </Flex>
      {errorMessage ? <Alert message={errorMessage} type="error" /> : null}
      {loadState.status === "loading" ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : null}
      {loadState.status === "error" ? (
        <Alert message={loadState.message} type="error" />
      ) : null}
      {loadState.status === "success" && loadState.skills.length === 0 ? (
        <Empty description="还没有安装技能" />
      ) : null}
      {loadState.status === "success" && loadState.skills.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            minHeight: 0,
            overflowY: "auto"
          }}
        >
          {loadState.skills.map((skill) => (
            <SkillCard
              key={skill.id}
              loading={busySkillId === skill.id}
              onToggle={toggleSkill}
              onUninstall={removeSkill}
              skill={skill}
            />
          ))}
        </div>
      ) : null}
      <SkillInstallModal
        confirmLoading={isInstalling}
        onCancel={() => setInstallModalOpen(false)}
        onSubmit={submitInstall}
        open={installModalOpen}
      />
    </Flex>
  );
}
