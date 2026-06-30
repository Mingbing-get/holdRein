import packageJson from "../package.json";

import { runCli } from "./index";

const result = runCli(process.argv.slice(2), {
  packageVersion: packageJson.version,
  write: (value: string): void => {
    process.stdout.write(value);
  }
});

process.exitCode = result.exitCode;
