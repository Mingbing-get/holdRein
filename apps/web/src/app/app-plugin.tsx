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
  senderSuggestions: WebPlugin.SuggestionGroup[];
  toolRenders: WebPlugin.ToolRender[];
  turnFooterRenders: WebPlugin.TurnFooterRender[];
}

const AppPluginContext = createContext<AppPluginContextValue | null>(null);

export function AppPluginProvider({ children }: PropsWithChildren) {
  const pluginRegistry = useRef<WebPluginRegistry>(createWebPluginRegistry())
  const loadGeneration = useRef(0)
  const [rightPanels, setRightPanels] = useState<WebPlugin.RightPanel[]>([])
  const [settings, setSettings] = useState<WebPlugin.SettingsItem[]>([])
  const [senderActions, setSenderActions] = useState<WebPlugin.SenderAction[]>([])
  const [senderSuggestions, setSenderSuggestions] = useState<WebPlugin.SuggestionGroup[]>([])
  const [toolRenders, setToolRenders] = useState<WebPlugin.ToolRender[]>([])
  const [turnFooterRenders, setTurnFooterRenders] = useState<WebPlugin.TurnFooterRender[]>([])

  const appUi = useAppUi()
  const appUiRef = useRef(appUi)
  const appUiSubscribers = useRef(new Set<WebPlugin.AppUiSubscriber>())

  const subscribeAppUi = useCallback((callback: WebPlugin.AppUiSubscriber) => {
    appUiSubscribers.current.add(callback)
    callback(appUiRef.current)

    return () => {
      appUiSubscribers.current.delete(callback)
    }
  }, [])

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
    if (contribution.turnFooterRenders?.length) {
      setTurnFooterRenders(old => {
        return [
          ...old,
          ...(contribution.turnFooterRenders || []).map(item => ({ ...item, id: `${pluginId}_${item.id}` }))
        ]
      })
    }
    if (contribution.toolRenders?.length) {
      setToolRenders(old => [...old, ...(contribution.toolRenders || [])])
    }
    if (contribution.senderSuggestions?.length) {
      setSenderSuggestions(old => [...old, ...(contribution.senderSuggestions || [])])
    }
  }, [])

  const clear = useCallback(() => {
    setRightPanels([])
    setSettings([])
    setSenderActions([])
    setToolRenders([])
    setTurnFooterRenders([])
    setSenderSuggestions([])
  }, [])

  const loadFromPlugins = useCallback(async (
    plugins: readonly WebPlugin.Plugin[],
    generation: number
  ) => {
    for (const plugin of plugins) {
      if (!plugin.contributionResolver) continue

      if (typeof plugin.contributionResolver === 'function') {
        const pluginInfo = await plugin.contributionResolver({
          request,
          subscribeAppUi
        })
        if (generation !== loadGeneration.current) return
        addContributionToState(plugin.id, pluginInfo)
      } else {
        if (generation !== loadGeneration.current) return
        addContributionToState(plugin.id, plugin.contributionResolver)
      }
    }
  }, [addContributionToState, subscribeAppUi])

  useEffect(() => {
    appUiRef.current = appUi
    for (const subscriber of appUiSubscribers.current) {
      subscriber(appUi)
    }
  }, [appUi])

  useEffect(() => {
    if (!pluginRegistry.current.has(baseWebPlugin.id)) {
      pluginRegistry.current.register(baseWebPlugin)
    }

    const plugins = pluginRegistry.current.list()
    const generation = loadGeneration.current + 1
    loadGeneration.current = generation

    clear()
    loadFromPlugins(plugins, generation)
    
    return pluginRegistry.current.on((plugin) => {
      loadFromPlugins([plugin], loadGeneration.current)
    })
  }, [clear, loadFromPlugins])

  const contextValue = useMemo(() => ({
    pluginRegistry: pluginRegistry.current,
    rightPanels,
    settings,
    senderActions,
    toolRenders,
    senderSuggestions,
    turnFooterRenders
  }), [
    rightPanels,
    senderActions,
    settings,
    toolRenders,
    senderSuggestions,
    turnFooterRenders
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
