import { startHoldReinServer } from "./runtime";

const DEFAULT_PORT = 3001;
const port = Number(process.env.PORT ?? DEFAULT_PORT);
const host = process.env.HOST ?? "127.0.0.1";

async function main() {
  await startHoldReinServer({
    host,
    port,
    write: (value) => {
      process.stdout.write(value);
    },
    devPluginPaths: ['/Users/mingbing/apps/ai-project/holdRein/packages/plugins/git']
  });
}

main()
