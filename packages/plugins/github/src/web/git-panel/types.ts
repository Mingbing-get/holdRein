export type GitRepositoryStatus =
  | { readonly initialized: false }
  | {
      readonly additions: number;
      readonly branches: readonly string[];
      readonly currentBranch: string;
      readonly deletions: number;
      readonly files: readonly string[];
      readonly hasChanges: boolean;
      readonly initialized: true;
    };
