import type { ButtonProps, MenuProps } from "antd";
import type { ComponentType, ReactNode } from "react";

export interface WebPluginAction {
  readonly id: string;
  readonly label: ReactNode;
  readonly icon?: ComponentType;
  readonly buttonProps?: ButtonProps;
  onClick?: () => void;
}

export interface WebPlugin {
  readonly id: string;
  readonly name?: string;
  readonly icon?: ComponentType;
  readonly actions?: readonly WebPluginAction[];
  readonly menuItems?: MenuProps["items"];
}

export interface WebPluginRegistry {
  register: (plugin: WebPlugin) => void;
  list: () => readonly WebPlugin[];
  get: (id: string) => WebPlugin | undefined;
  has: (id: string) => boolean;
}

export function createWebPluginRegistry(): WebPluginRegistry {
  const plugins = new Map<string, WebPlugin>();

  return {
    register(plugin) {
      if (plugins.has(plugin.id)) {
        throw new Error(`Web plugin "${plugin.id}" is already registered.`);
      }

      plugins.set(plugin.id, plugin);
    },
    list() {
      return [...plugins.values()];
    },
    get(id) {
      return plugins.get(id);
    },
    has(id) {
      return plugins.has(id);
    }
  };
}
