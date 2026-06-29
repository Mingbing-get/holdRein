import type { WebPlugin } from '@hold-rein/plugin-web'
import { PLUGIN_ID } from "./plugin-id";

const baseWebPlugin: WebPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: {}
}

export default baseWebPlugin
