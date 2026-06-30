import { cp, mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";

import {
  type GithubPluginSource,
  parseGithubPluginSource
} from "./plugin-github-source";
import {
  type PluginInstallCommandRunner,
  type PluginInstallWriter,
  runInstallCommand
} from "./plugin-install-command";
import {
  createPublishedManifest,
  isBuiltPackageManifest,
  readValidPluginPackageManifest
} from "./plugin-package-manifest";

export interface CopyInstalledPluginPackageOptions {
  readonly packageName: string;
  readonly pluginRoot: string;
  readonly sourcePackageDir: string;
  readonly write?: PluginInstallWriter | undefined;
}

export interface InstallNpmPluginPackageOptions {
  readonly packageName: string;
  readonly pluginRoot: string;
  readonly tempRoot?: string;
  readonly runCommand?: PluginInstallCommandRunner;
  readonly write?: PluginInstallWriter | undefined;
}

export interface InstallPluginPackageOptions {
  readonly currentWorkingDirectory?: string;
  readonly installGitRepository?: (
    repositoryUrl: string,
    targetDir: string,
    ref?: string
  ) => Promise<void>;
  readonly pluginRoot: string;
  readonly runCommand?: PluginInstallCommandRunner;
  readonly source: string;
  readonly tempRoot?: string;
  readonly write?: PluginInstallWriter | undefined;
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
  options.write?.(
    `Copying plugin files: ${options.sourcePackageDir} -> ${destination}\n`
  );
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
  await runInstallCommand(
    options.runCommand,
    "npm",
    ["install", options.packageName, "--ignore-scripts"],
    installDir,
    options.write
  );

  const sourcePackageDir = join(
    installDir,
    "node_modules",
    ...options.packageName.split("/")
  );

  await readValidPluginPackageManifest(sourcePackageDir);

  return copyInstalledPluginPackage({
    packageName: options.packageName,
    pluginRoot: options.pluginRoot,
    sourcePackageDir,
    write: options.write
  });
}

export async function installPluginPackage(
  options: InstallPluginPackageOptions
): Promise<string> {
  const githubSource = parseGithubPluginSource(options.source);

  if (githubSource) {
    return installGithubPluginPackage(options, githubSource);
  }

  const localDirectory = await resolveLocalDirectory(
    options.source,
    options.currentWorkingDirectory
  );

  if (localDirectory) {
    return installLocalPluginPackage(options, localDirectory);
  }

  return installNpmPluginPackage({
    packageName: options.source,
    pluginRoot: options.pluginRoot,
    ...(options.runCommand === undefined
      ? {}
      : { runCommand: options.runCommand }),
    ...(options.tempRoot === undefined ? {} : { tempRoot: options.tempRoot }),
    ...(options.write === undefined ? {} : { write: options.write })
  });
}

async function installLocalPluginPackage(
  options: InstallPluginPackageOptions,
  sourceDirectory: string
): Promise<string> {
  await readValidPluginPackageManifest(sourceDirectory);
  await ensurePnpmAvailable(options.runCommand, sourceDirectory, options.write);
  await runInstallCommand(
    options.runCommand,
    "pnpm",
    ["install"],
    sourceDirectory,
    options.write
  );
  await runInstallCommand(
    options.runCommand,
    "pnpm",
    ["build"],
    sourceDirectory,
    options.write
  );

  return installBuiltSourcePackage(sourceDirectory, options.pluginRoot, options.write);
}

async function installGithubPluginPackage(
  options: InstallPluginPackageOptions,
  githubSource: GithubPluginSource
): Promise<string> {
  const tempRoot =
    options.tempRoot ?? (await mkdtemp(join(tmpdir(), "hold-rein-plugin-")));
  await mkdir(tempRoot, { recursive: true });
  const cloneDir = await mkdtemp(join(tempRoot, "github-"));
  const installGitRepository = options.installGitRepository ?? cloneGitRepository;

  try {
    if (githubSource.ref) {
      await installGitRepository(
        githubSource.repositoryUrl,
        cloneDir,
        githubSource.ref
      );
    } else {
      await installGitRepository(githubSource.repositoryUrl, cloneDir);
    }

    const sourceDirectory =
      githubSource.subdirectory === undefined
        ? cloneDir
        : join(cloneDir, githubSource.subdirectory);

    const manifest = await readValidPluginPackageManifest(sourceDirectory);

    if (isBuiltPackageManifest(manifest)) {
      return await copyInstalledPluginPackage({
        packageName: manifest.name,
        pluginRoot: options.pluginRoot,
        sourcePackageDir: sourceDirectory,
        write: options.write
      });
    }

    await ensurePnpmAvailable(options.runCommand, sourceDirectory, options.write);
    await runInstallCommand(
      options.runCommand,
      "pnpm",
      ["install"],
      sourceDirectory,
      options.write
    );
    await runInstallCommand(
      options.runCommand,
      "pnpm",
      ["build"],
      sourceDirectory,
      options.write
    );

    return await installBuiltSourcePackage(
      sourceDirectory,
      options.pluginRoot,
      options.write
    );
  } finally {
    await rm(cloneDir, { force: true, recursive: true });
  }
}

async function installBuiltSourcePackage(
  sourceDirectory: string,
  pluginRoot: string,
  write: PluginInstallWriter | undefined
): Promise<string> {
  const directDistPackage = await resolveLocalDirectory(
    join(sourceDirectory, "dist")
  );

  if (directDistPackage && (await hasPackageManifest(directDistPackage))) {
    const manifest = await readValidPluginPackageManifest(directDistPackage);

    return copyInstalledPluginPackage({
      packageName: manifest.name,
      pluginRoot,
      sourcePackageDir: directDistPackage,
      write
    });
  }

  const manifest = await readValidPluginPackageManifest(sourceDirectory);
  const stagingDir = await mkdtemp(join(tmpdir(), "hold-rein-plugin-package-"));

  try {
    await writeFile(
      join(stagingDir, "package.json"),
      `${JSON.stringify(createPublishedManifest(manifest), null, 2)}\n`
    );
    await cp(join(sourceDirectory, "dist"), join(stagingDir, "dist"), {
      recursive: true
    });
    await readValidPluginPackageManifest(stagingDir);

    return await copyInstalledPluginPackage({
      packageName: manifest.name,
      pluginRoot,
      sourcePackageDir: stagingDir,
      write
    });
  } finally {
    await rm(stagingDir, { force: true, recursive: true });
  }
}

async function hasPackageManifest(directory: string): Promise<boolean> {
  try {
    await stat(join(directory, "package.json"));
    return true;
  } catch {
    return false;
  }
}

async function ensurePnpmAvailable(
  runCommand: PluginInstallCommandRunner | undefined,
  cwd: string,
  write: PluginInstallWriter | undefined
): Promise<void> {
  try {
    await runInstallCommand(runCommand, "pnpm", ["--version"], cwd, write);
  } catch {
    try {
      await runInstallCommand(
        runCommand,
        "npm",
        ["install", "--global", "pnpm"],
        cwd,
        write
      );
    } catch {
      throw new Error("pnpm is required to build plugin sources");
    }
  }
}

async function resolveLocalDirectory(
  source: string,
  currentWorkingDirectory = process.cwd()
): Promise<string | undefined> {
  const directory = isAbsolute(source)
    ? source
    : resolve(currentWorkingDirectory, source);

  try {
    const stats = await stat(directory);
    return stats.isDirectory() ? directory : undefined;
  } catch {
    return undefined;
  }
}

async function cloneGitRepository(
  repositoryUrl: string,
  targetDir: string
): Promise<void> {
  await runInstallCommand(
    undefined,
    "git",
    ["clone", "--depth", "1", repositoryUrl, targetDir],
    process.cwd()
  );
}
