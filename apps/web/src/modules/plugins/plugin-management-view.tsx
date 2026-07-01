import { AppstoreAddOutlined, PlusOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Flex, Spin, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";

import { PluginCard } from "./plugin-card";
import {
  fetchInstalledPlugins,
  installPlugin,
  setPluginDisabled
} from "./plugin-management-api";
import { PluginInstallModal } from "./plugin-install-modal";
import type {
  InstalledPlugin,
  PluginInstallRequest
} from "./plugin-management-types";

interface PluginManagementViewProps {
  apiBaseUrl: string;
}

type LoadState =
  | { status: "loading" }
  | { plugins: InstalledPlugin[]; status: "success" }
  | { message: string; status: "error" };

export function PluginManagementView({ apiBaseUrl }: PluginManagementViewProps) {
  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [busyPluginId, setBusyPluginId] = useState<string | null>(null);
  const [isInstalling, setIsInstalling] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const refreshPlugins = useCallback(async () => {
    setLoadState({ status: "loading" });
    try {
      setLoadState({
        plugins: await fetchInstalledPlugins(apiBaseUrl),
        status: "success"
      });
    } catch (error) {
      setLoadState({
        message: error instanceof Error ? error.message : "Failed to load plugins",
        status: "error"
      });
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    void refreshPlugins();
  }, [refreshPlugins]);

  const togglePlugin = async (plugin: InstalledPlugin, enabled: boolean) => {
    setBusyPluginId(plugin.id);
    setErrorMessage("");
    try {
      const updatedPlugin = await setPluginDisabled(
        apiBaseUrl,
        plugin.id,
        !enabled
      );
      setLoadState((currentState) =>
        currentState.status === "success"
          ? {
              plugins: currentState.plugins.map((currentPlugin) =>
                currentPlugin.id === updatedPlugin.id
                  ? updatedPlugin
                  : currentPlugin
              ),
              status: "success"
            }
          : currentState
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update plugin"
      );
    } finally {
      setBusyPluginId(null);
    }
  };

  const submitInstall = async (values: PluginInstallRequest) => {
    setIsInstalling(true);
    setErrorMessage("");
    try {
      await installPlugin(apiBaseUrl, values);
      setInstallModalOpen(false);
      await refreshPlugins();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to install plugin"
      );
    } finally {
      setIsInstalling(false);
    }
  };

  return (
    <Flex gap={12} style={{ minHeight: 0 }} vertical>
      <Flex align="center" justify="space-between">
        <Flex align="center" gap={10}>
          <AppstoreAddOutlined style={{ color: "var(--app-color-primary)" }} />
          <Typography.Title level={4} style={{ margin: 0 }}>
            插件管理
          </Typography.Title>
        </Flex>
        <Button
          aria-label="安装插件"
          icon={<PlusOutlined />}
          onClick={() => setInstallModalOpen(true)}
          type="primary"
        >
          安装插件
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
      {loadState.status === "success" && loadState.plugins.length === 0 ? (
        <Empty description="还没有安装插件" />
      ) : null}
      {loadState.status === "success" && loadState.plugins.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            minHeight: 0,
            overflowY: "auto"
          }}
        >
          {loadState.plugins.map((plugin) => (
            <PluginCard
              key={plugin.id}
              loading={busyPluginId === plugin.id}
              onToggle={togglePlugin}
              plugin={plugin}
            />
          ))}
        </div>
      ) : null}
      <PluginInstallModal
        apiBaseUrl={apiBaseUrl}
        confirmLoading={isInstalling}
        onCancel={() => setInstallModalOpen(false)}
        onSubmit={submitInstall}
        open={installModalOpen}
      />
    </Flex>
  );
}
