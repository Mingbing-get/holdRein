import { access, cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const cliRuntimeDirectory = resolve(root, "apps/cli/dist/runtime");

await rm(cliRuntimeDirectory, { force: true, recursive: true });
await mkdir(cliRuntimeDirectory, { recursive: true });
const apiRuntimeDirectory = resolve(cliRuntimeDirectory, "api");

await copyRuntimeApi(resolve(root, "apps/api/dist"), apiRuntimeDirectory);
await fixRuntimeApiImports(apiRuntimeDirectory);
await cp(resolve(root, "apps/web/dist"), resolve(cliRuntimeDirectory, "web"), {
  recursive: true
});

async function copyRuntimeApi(sourceDirectory, destinationDirectory) {
  await mkdir(destinationDirectory, { recursive: true });

  const entries = await readdir(sourceDirectory, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDirectory, entry.name);
    const destinationPath = join(destinationDirectory, entry.name);

    if (entry.isDirectory()) {
      await copyRuntimeApi(sourcePath, destinationPath);
      continue;
    }

    if (entry.name.includes(".test.") || entry.name.includes("test-utils")) {
      continue;
    }

    await cp(sourcePath, destinationPath);
  }
}

async function fixRuntimeApiImports(directory) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(directory, entry.name);

    if (entry.isDirectory()) {
      await fixRuntimeApiImports(entryPath);
      continue;
    }

    if (!entry.name.endsWith(".js")) {
      continue;
    }

    const source = await readFile(entryPath, "utf8");
    const fixed = await replaceRelativeSpecifiers(source, entryPath);

    if (fixed !== source) {
      await writeFile(entryPath, fixed);
    }
  }
}

async function replaceRelativeSpecifiers(source, filePath) {
  const fromPattern = /(from\s+["'])(\.{1,2}\/[^"']+)(["'])/g;
  const importPattern = /(import\s*\(\s*["'])(\.{1,2}\/[^"']+)(["']\s*\))/g;

  let fixed = source;
  fixed = await replaceAsync(fixed, fromPattern, filePath);
  fixed = await replaceAsync(fixed, importPattern, filePath);

  return fixed;
}

async function replaceAsync(source, pattern, filePath) {
  const replacements = await Promise.all(
    [...source.matchAll(pattern)].map(async (match) => ({
      match: match[0],
      replacement: `${match[1]}${await resolveRuntimeSpecifier(filePath, match[2])}${match[3]}`
    }))
  );

  return replacements.reduce(
    (value, item) => value.replace(item.match, item.replacement),
    source
  );
}

async function resolveRuntimeSpecifier(filePath, specifier) {
  if (specifier.endsWith(".js") || specifier.endsWith(".json")) {
    return specifier;
  }

  const basePath = resolve(dirname(filePath), specifier);

  if (await pathExists(`${basePath}.js`)) {
    return `${specifier}.js`;
  }

  if (await pathExists(join(basePath, "index.js"))) {
    return `${specifier}/index.js`;
  }

  return specifier;
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
