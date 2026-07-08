export function createMemoryExtractorPrompt(messages: readonly unknown[]): string {
  return [
    "You are the memory extractor for this workspace.",
    "Extract meaningful memory candidates from the conversation messages.",
    "Include durable facts, summaries, events, user preferences, decisions, constraints, and project knowledge that may be useful in future runs.",
    "Ignore transient tool noise, failed attempts without lasting relevance, and information that is only useful for the current turn.",
    "Do not read or modify files. Do not call tools. Return a concise structured summary for the memory organizer.",
    "If there is no durable information to remember, say exactly: No durable memory candidates.",
    "",
    "Complete conversation transcript (JSON):",
    JSON.stringify(messages, null, 2)
  ].join("\n");
}
