export interface ConversationSummary {
  id: string;
  name: string;
  shortLabel: string;
}

export interface WorkspaceSummary {
  conversations: ConversationSummary[];
  id: string;
  name: string;
  path: string;
}

export const workspaceSummaries: WorkspaceSummary[] = [
  {
    conversations: [
      {
        id: "conv-ops-sync",
        name: "Sprint Planning",
        shortLabel: "SP"
      },
      {
        id: "conv-release-audit",
        name: "Release Audit",
        shortLabel: "RA"
      }
    ],
    id: "workspace-engineering",
    name: "Engineering Hub",
    path: "/Users/mingbing/workspaces/engineering-hub"
  },
  {
    conversations: [
      {
        id: "conv-design-research",
        name: "Model Research",
        shortLabel: "MR"
      },
      {
        id: "conv-agent-ops",
        name: "Agent Operations",
        shortLabel: "AO"
      }
    ],
    id: "workspace-labs",
    name: "Labs Sandbox",
    path: "/Users/mingbing/workspaces/labs-sandbox"
  }
];
