export interface GithubPluginSource {
  readonly ref?: string;
  readonly repositoryUrl: string;
  readonly subdirectory?: string;
}

export function parseGithubPluginSource(
  source: string
): GithubPluginSource | undefined {
  const trimmedSource = source.trim();
  const rootMatch =
    /^https:\/\/github\.com\/(?<owner>[^/\s]+)\/(?<repo>[^/\s]+?)(?:\.git)?\/?$/u.exec(
      trimmedSource
    ) ??
    /^git@github\.com:(?<owner>[^/\s]+)\/(?<repo>[^/\s]+?)(?:\.git)?$/u.exec(
      trimmedSource
    );

  if (rootMatch?.groups) {
    const { owner, repo } = rootMatch.groups;

    if (!owner || !repo) {
      return undefined;
    }

    return {
      repositoryUrl: toGitRepositoryUrl(
        owner,
        repo,
        trimmedSource.startsWith("git@github.com:")
      )
    };
  }

  const webMatch =
    /^https:\/\/github\.com\/(?<owner>[^/\s]+)\/(?<repo>[^/\s]+)\/(?<kind>tree|blob)\/(?<ref>[^/\s]+)(?:\/(?<path>.*))?\/?$/u.exec(
      trimmedSource
    );

  if (!webMatch?.groups) {
    return undefined;
  }

  const { kind, owner, path, ref, repo } = webMatch.groups;

  if (!kind || !owner || !ref || !repo) {
    return undefined;
  }

  const pathSegments = normalizeGithubPathSegments(path);
  const subdirectory =
    kind === "blob" && pathSegments.at(-1) === "package.json"
      ? pathSegments.slice(0, -1).join("/")
      : pathSegments.join("/");

  return {
    ref,
    repositoryUrl: toGitRepositoryUrl(owner, repo),
    ...(subdirectory.length === 0 ? {} : { subdirectory })
  };
}

function normalizeGithubPathSegments(path: string | undefined): string[] {
  if (!path) {
    return [];
  }

  const segments = path.split("/").filter((segment) => segment.length > 0);

  if (segments.some((segment) => segment === "." || segment === "..")) {
    return [];
  }

  return segments;
}

function toGitRepositoryUrl(
  owner: string,
  repo: string,
  useSsh = false
): string {
  return useSsh
    ? `git@github.com:${owner}/${repo}.git`
    : `https://github.com/${owner}/${repo}.git`;
}
