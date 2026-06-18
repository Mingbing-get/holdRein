import { complete } from "@earendil-works/pi-ai";

import {
  resolveAgentModel,
  type AgentModelLookup
} from "../model/resolver";

export interface GenerateTaskTitleInput {
  apiKey?: string;
  modelId: string;
  prompt: string;
  provider: string;
}

export interface TaskTitleGenerator {
  generateTitle: (input: GenerateTaskTitleInput) => Promise<string>;
}

export interface CreateTaskTitleGeneratorOptions {
  getCustomModel?: AgentModelLookup;
}

export function createDefaultTaskTitleGenerator(
  options: CreateTaskTitleGeneratorOptions = {}
): TaskTitleGenerator {
  return {
    generateTitle: async (input) => {
      const model = await resolveAgentModel(
        input.provider,
        input.modelId,
        options.getCustomModel
      );

      if (!model) {
        return createFallbackTitle(input.prompt);
      }

      try {
        const message = await complete(
          model,
          {
            messages: [
              {
                content: [
                  {
                    text: [
                      "Create a concise task title for this user request.",
                      "Return only the title, without quotes or punctuation wrappers.",
                      `Request: ${input.prompt}`
                    ].join("\n"),
                    type: "text"
                  }
                ],
                role: "user",
                timestamp: Date.now()
              }
            ],
            systemPrompt: "You create short software task titles."
          },
          {
            ...(input.apiKey ? { apiKey: input.apiKey } : {}),
            maxTokens: 64,
            temperature: 0.2
          }
        );
        const title = message.content
          .filter((content) => content.type === "text")
          .map((content) => content.text)
          .join("")
          .trim();

        return normalizeGeneratedTitle(title, input.prompt);
      } catch {
        return createFallbackTitle(input.prompt);
      }
    }
  };
}

function normalizeGeneratedTitle(title: string, prompt: string): string {
  const normalizedTitle = title
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return normalizedTitle.length > 0
    ? normalizedTitle.slice(0, 80)
    : createFallbackTitle(prompt);
}

function createFallbackTitle(prompt: string): string {
  const normalizedPrompt = prompt.replace(/\s+/g, " ").trim();

  return normalizedPrompt.length > 0
    ? normalizedPrompt.slice(0, 80)
    : "New task";
}
