import packageJson from "../package.json";

import { runCli } from "./index";

async function main(): Promise<void> {
  const result = await runCli(process.argv.slice(2), {
    currentWorkingDirectory: process.cwd(),
    packageVersion: packageJson.version,
    write: (value: string): void => {
      process.stdout.write(value);
    }
  });

  process.exitCode = result.exitCode;
}

void main();
