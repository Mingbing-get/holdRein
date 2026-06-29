import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface CopyInstalledPluginPackageOptions {
  readonly packageName: string;
  readonly pluginRoot: string;
  readonly sourcePackageDir: string;
}

export interface InstallNpmPluginPackageOptions {
  readonly packageName: string;
  readonly pluginRoot: string;
  readonly tempRoot?: string;
}

export function encodePluginDirectoryName(packageName: string): string {
  return packageName.replaceAll("/", "__");
}

export async function copyInstalledPluginPackage(
  options: CopyInstalledPluginPackageOptions
): Promise<string> {
  const destination = join(
    options.pluginRoot,
    encodePluginDirectoryName(options.packageName)
  );

  await mkdir(options.pluginRoot, { recursive: true });
  await rm(destination, { force: true, recursive: true });
  await cp(options.sourcePackageDir, destination, { recursive: true });

  return destination;
}

export async function installNpmPluginPackage(
  options: InstallNpmPluginPackageOptions
): Promise<string> {
  const tempRoot =
    options.tempRoot ?? (await mkdtemp(join(tmpdir(), "hold-rein-plugin-")));

  await mkdir(tempRoot, { recursive: true });

  const installDir = await mkdtemp(join(tempRoot, "install-"));

  await writeFile(
    join(installDir, "package.json"),
    JSON.stringify({ private: true, type: "module" }, null, 2)
  );
  await execFileAsync("npm", ["install", options.packageName, "--ignore-scripts"], {
    cwd: installDir
  });

  return copyInstalledPluginPackage({
    packageName: options.packageName,
    pluginRoot: options.pluginRoot,
    sourcePackageDir: join(
      installDir,
      "node_modules",
      ...options.packageName.split("/")
    )
  });
}
