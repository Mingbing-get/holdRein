import {
  createWebPluginRegistry,
  loadRuntimeWebPlugins,
  registerBrowserToolExecutor,
  type RuntimePluginManifest,
  type WebPluginRegistry,
  type WebPlugin
} from '@hold-rein/plugin-web'

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

interface RuntimePluginsResponse {
  readonly plugins: readonly RuntimePluginManifest[];
}

export interface AppPluginProviderProps extends PropsWithChildren {
  readonly runtimePluginImporter?: (
    entryUrl: string
  ) => Promise<WebPlugin.Plugin>;
}

export interface AppPluginContextValue {
  pluginRegistry: WebPluginRegistry;
  reloadRuntimePlugins: () => Promise<void>;
  rightPanels: WebPlugin.RightPanel[];
  runtimeContributions: WebPlugin.ResolvedBrowserRuntimeContributions;
  settings: WebPlugin.SettingsItem[];
  senderActions: WebPlugin.SenderAction[];
  senderSuggestions: WebPlugin.SuggestionGroup[];
  toolRenders: WebPlugin.ToolRender[];
  turnFooterRenders: WebPlugin.TurnFooterRender[];
}

const AppPluginContext = createContext<AppPluginContextValue | null>(null);

const EMPTY_RUNTIME_CONTRIBUTIONS: WebPlugin.ResolvedBrowserRuntimeContributions = {
  skills: [],
  systemPrompts: [],
  tools: []
};

export function AppPluginProvider({
  children,
  runtimePluginImporter
}: AppPluginProviderProps) {
  const pluginRegistry = useRef<WebPluginRegistry>(createWebPluginRegistry())
  const loadGeneration = useRef(0)
  const reloadQueue = useRef<Promise<void>>(Promise.resolve())
  const browserToolDisposers = useRef<(() => void)[]>([])
  const runtimePluginIds = useRef<Set<string>>(new Set())
  const runtimePluginManifests = useRef<readonly RuntimePluginManifest[]>([])
  const [rightPanels, setRightPanels] = useState<WebPlugin.RightPanel[]>([])
  const [runtimeContributions, setRuntimeContributions] =
    useState<WebPlugin.ResolvedBrowserRuntimeContributions>(
      EMPTY_RUNTIME_CONTRIBUTIONS
    )
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
    const tools = contribution.tools
    if (tools?.length) {
      browserToolDisposers.current.push(
        ...tools.map((tool) =>
          registerBrowserToolExecutor(
            tool.name,
            tool.executor,
            tool.beforeExecute
          )
        )
      )
      setRuntimeContributions((old) => ({
        ...old,
        tools: [
          ...old.tools,
          ...tools.map((tool) => ({
            ...(tool.description === undefined
              ? {}
              : { description: tool.description }),
            inputSchema: tool.params,
            name: tool.name
          }))
        ]
      }))
    }
    const skills = contribution.skills
    if (skills?.length) {
      setRuntimeContributions((old) => ({
        ...old,
        skills: [...old.skills, ...skills]
      }))
    }
    const systemPrompts = contribution.systemPrompts
    if (systemPrompts?.length) {
      setRuntimeContributions((old) => ({
        ...old,
        systemPrompts: [...old.systemPrompts, ...systemPrompts]
      }))
    }
    if (contribution.senderSuggestions?.length) {
      setSenderSuggestions(old => [...old, ...(contribution.senderSuggestions || [])])
    }
  }, [])

  const clearBrowserToolRegistrations = useCallback(() => {
    for (const dispose of browserToolDisposers.current) {
      dispose()
    }
    browserToolDisposers.current = []
  }, [])

  const clear = useCallback(() => {
    clearBrowserToolRegistrations()
    setRightPanels([])
    setRuntimeContributions(EMPTY_RUNTIME_CONTRIBUTIONS)
    setSettings([])
    setSenderActions([])
    setToolRenders([])
    setTurnFooterRenders([])
    setSenderSuggestions([])
  }, [clearBrowserToolRegistrations])

  const unregisterRuntimePlugins = useCallback(() => {
    for (const manifest of runtimePluginManifests.current) {
      removePluginStyle(manifest)
    }

    for (const pluginId of runtimePluginIds.current) {
      pluginRegistry.current.unregister(pluginId)
    }

    runtimePluginIds.current = new Set()
    runtimePluginManifests.current = []
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

  const performRuntimePluginReload = useCallback(async () => {
    const generation = loadGeneration.current + 1
    loadGeneration.current = generation

    unregisterRuntimePlugins()
    clear()

    loadFromPlugins(pluginRegistry.current.list(), generation)

    const { data } = await request<RuntimePluginsResponse>({
      method: "GET",
      path: "/api/v1/plugins"
    })

    if (generation !== loadGeneration.current) return

    const loadedPlugins = await loadRuntimeWebPlugins({
      ...(runtimePluginImporter === undefined
        ? {}
        : { importer: runtimePluginImporter }),
      manifests: data.plugins,
      registry: pluginRegistry.current
    })

    if (generation !== loadGeneration.current) {
      return
    }

    runtimePluginManifests.current = data.plugins
    runtimePluginIds.current = new Set(
      loadedPlugins.map((plugin) => plugin.id)
    )
  }, [clear, loadFromPlugins, runtimePluginImporter, unregisterRuntimePlugins])

  const reloadRuntimePlugins = useCallback(async () => {
    const reload = reloadQueue.current
      .catch(() => undefined)
      .then(() => performRuntimePluginReload())

    reloadQueue.current = reload
    await reload
  }, [performRuntimePluginReload])

  useEffect(() => {
    const offPluginRegistered = pluginRegistry.current.on((plugin) => {
      loadFromPlugins([plugin], loadGeneration.current)
    })

    void reloadRuntimePlugins().catch(() => undefined)

    return () => {
      offPluginRegistered()
      clearBrowserToolRegistrations()
      unregisterRuntimePlugins()
    }
  }, [
    clearBrowserToolRegistrations,
    loadFromPlugins,
    reloadRuntimePlugins,
    unregisterRuntimePlugins
  ])

  const contextValue = useMemo(() => ({
    pluginRegistry: pluginRegistry.current,
    reloadRuntimePlugins,
    rightPanels,
    runtimeContributions,
    settings,
    senderActions,
    toolRenders,
    senderSuggestions,
    turnFooterRenders
  }), [
    rightPanels,
    reloadRuntimePlugins,
    runtimeContributions,
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

function removePluginStyle(manifest: RuntimePluginManifest): void {
  if (!manifest.webStyle || typeof document === "undefined") {
    return;
  }

  const styleUrl = new URL(manifest.webStyle, document.baseURI).href;
  for (const link of document.head.querySelectorAll<HTMLLinkElement>(
    'link[rel="stylesheet"]'
  )) {
    if (link.href === styleUrl) {
      link.remove()
    }
  }
}

export function useAppPlugins() {
  const contextValue = useContext(AppPluginContext);

  if (!contextValue) {
    throw new Error("useAppPlugin must be used within an AppPluginProvider");
  }

  return contextValue;
}

export function useOptionalAppPlugins() {
  return useContext(AppPluginContext);
}
