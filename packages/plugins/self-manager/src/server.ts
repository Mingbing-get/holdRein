import type { ServerPlugin } from "@hold-rein/plugin-server";
import { PLUGIN_ID } from "./plugin-id";

const baseServerPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
};

export default baseServerPlugin;
