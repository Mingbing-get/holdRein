import { createWebPluginRegistry, type WebPluginRegistry, type WebPlugin } from '@hold-rein/plugin-web'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren
} from "react";

import { useAppUi } from './app-ui-context';
import { request } from '../api/request';
import baseWebPlugin from '@hold-rein/plugins-base-web';

export interface AppPluginContextValue {
  pluginRegistry: WebPluginRegistry;
  rightPanels: WebPlugin.RightPanel[];
  settings: WebPlugin.SettingsItem[];
  senderActions: WebPlugin.SenderAction[];
  toolRenders: WebPlugin.ToolRender[];
}

const AppPluginContext = createContext<AppPluginContextValue | null>(null);

export function AppPluginProvider({ children }: PropsWithChildren) {
  const pluginRegistry = useRef<WebPluginRegistry>(createWebPluginRegistry())
  const [rightPanels, setRightPanels] = useState<WebPlugin.RightPanel[]>([])
  const [settings, setSettings] = useState<WebPlugin.SettingsItem[]>([])
  const [senderActions, setSenderActions] = useState<WebPlugin.SenderAction[]>([])
  const [toolRenders, setToolRenders] = useState<WebPlugin.ToolRender[]>([])

  const appUi = useAppUi()

  const addContributionToState = useCallback((pluginId: string, contribution: WebPlugin.Contribution) => {
    if (contribution.rightPanels?.length) {
      setRightPanels(old => {
        return [
          ...old,
          ...(contribution.rightPanels || []).map(item => ({ ...item, id: `${pluginId}_${item.id}` }))
        ]
      })
    }
    if (contribution.settings?.length) {
      setSettings(old => {
        return [
          ...old,
          ...(contribution.settings || []).map(item => ({ ...item, id: `${pluginId}_${item.id}` }))
        ]
      })
    }
    if (contribution.senderActions?.length) {
      setSenderActions(old => {
        return [
          ...old,
          ...(contribution.senderActions || []).map(item => ({ ...item, id: `${pluginId}_${item.id}` }))
        ]
      })
    }
    if (contribution.toolRenders?.length) {
      setToolRenders(old => [...old, ...(contribution.toolRenders || [])])
    }
  }, [])

  const clear = useCallback(() => {
    setRightPanels([])
    setSettings([])
    setSenderActions([])
    setToolRenders([])
  }, [])

  const loadFromPlugins = useCallback(async (plugins: readonly WebPlugin.Plugin[]) => {
    for (const plugin of plugins) {
      if (!plugin.contributionResolver) continue

      if (typeof plugin.contributionResolver === 'function') {
        const pluginInfo = await plugin.contributionResolver({
          appUi,
          request
        })
        addContributionToState(plugin.id, pluginInfo)
      } else {
        addContributionToState(plugin.id, plugin.contributionResolver)
      }
    }
  }, [appUi])

  useEffect(() => {
    if (!pluginRegistry.current.has(baseWebPlugin.id)) {
      pluginRegistry.current.register(baseWebPlugin)
    }

    const plugins = pluginRegistry.current.list()

    clear()
    loadFromPlugins(plugins)
    
    return pluginRegistry.current.on((plugin) => {
      loadFromPlugins([plugin])
    })
  }, [loadFromPlugins])

  const contextValue = useMemo(() => ({
    pluginRegistry: pluginRegistry.current,
    rightPanels,
    settings,
    senderActions,
    toolRenders
  }), [
    rightPanels,
    senderActions,
    settings,
    toolRenders
  ])

  return (
    <AppPluginContext.Provider value={contextValue}>
      { children }
    </AppPluginContext.Provider>
  )
}

export function useAppPlugins() {
  const contextValue = useContext(AppPluginContext);

  if (!contextValue) {
    throw new Error("useAppPlugin must be used within an AppPluginProvider");
  }

  return contextValue;
}
