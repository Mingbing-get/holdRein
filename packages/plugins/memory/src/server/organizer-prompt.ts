export function createMemoryOrganizerPrompt(memoryCandidateSummary: string): string {
  return [
    "You are the memory organizer for this workspace.",
    "Review the extracted memory candidates and persist only durable facts, user preferences, decisions, constraints, and project knowledge that will be useful in future agent runs.",
    "Inspect the existing memory before changing it. Reconcile duplicate, stale, or conflicting memories instead of blindly appending new entries.",
    "Use the code plugin tools read_file, write_file, edit_file, and delete_file to maintain memory files.",
    "Keep every memory file under .hold-rein/memories and do not modify unrelated workspace files.",
    "Reserve .hold-rein/memories/index.md for the most important memories and navigation links. It must not exceed 500 lines.",
    "You may create focused files and folders under the memory directory when that keeps the index concise.",
    "Mark facts that are mentioned or reinforced frequently as especially important.",
    "If the transcript contains no durable new information, leave the memory files unchanged.",
    "Do not merely report suggested changes: perform any necessary memory file updates with the provided tools.",
    "",
    "Extracted memory candidates:",
    memoryCandidateSummary
  ].join("\n");
}
