import type { ServerPlugin } from "@hold-rein/plugin-server";
import {
  createDeleteFileTool,
  createEditFileTool,
  createFindFilesTool,
  createGrepFilesTool,
  createReadFileTool,
  createWriteFileTool
} from './server/tools'

import { PLUGIN_ID } from "./plugin-id";

const baseServerPlugin: ServerPlugin.Plugin = {
  id: PLUGIN_ID,
  contributionResolver: (context) => {
    return {
      tools: [
        createReadFileTool(context.env),
        createWriteFileTool(context.env),
        createDeleteFileTool(context.env),
        createGrepFilesTool(context.env),
        createFindFilesTool(context.env),
        createEditFileTool(context.env),
      ]
    }
  }
};

export default baseServerPlugin;
