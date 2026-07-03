# Memory Plugin Design

## Goal

Implement durable workspace memory in `@hold-rein/plugins-memory`. Agents can
read curated memory while working, and the main agent starts a final,
low-priority memory-organizer subagent only when no other plugin continuation is
needed.

## Runtime behavior

The plugin contribution resolver reads
`<workspace>/.hold-rein/memories/index.md`. Every agent except the dedicated
`memory-organizer` receives a system prompt that identifies the memory directory
as available workspace context. When the index exists, its contents are embedded
in that prompt as the primary memory. A missing or unreadable index is treated as
an empty memory store and must not prevent an agent from starting.

Only the main agent contributes an `onAgentEnd` handler. The handler has priority
`-9999`, so the plugin host invokes it only after all higher-priority handlers
decline to continue. It returns a named `memory-organizer` subagent continuation
whose prompt contains a JSON serialization of every message supplied to the end
event.

The organizer itself receives neither the normal memory system prompt nor an end
handler. This prevents recursive memory-organizer creation while still allowing
the organizer to inspect workspace memory through code-plugin file tools.

## Organizer responsibilities

The organizer prompt instructs the child agent to:

- extract only durable facts, preferences, decisions, constraints, and useful
  project knowledge from the supplied transcript;
- inspect existing files before writing and reconcile duplicates, stale facts,
  and conflicts rather than blindly appending;
- use the code plugin's read, write, edit, and delete file tools;
- keep all memory under `.hold-rein/memories`;
- keep `index.md` at or below 500 lines and reserve it for the most important
  memories and navigation to more focused files or folders;
- mark frequently reinforced facts clearly;
- avoid modifying unrelated workspace files.

## Error handling

Index reads catch filesystem errors and fall back to the directory guidance.
Message serialization uses the event's complete `messages` array. The runtime's
existing continuation machinery remains responsible for starting and reporting
the subagent.

## Tests

Tests exercise the exported plugin through its contribution resolver and verify:

- normal agents receive directory guidance and embedded index content;
- a missing index degrades to directory guidance;
- the organizer receives neither memory injection nor an end handler;
- only the main agent exposes the end handler;
- the end handler has priority `-9999` and creates a named subagent;
- the organizer prompt contains the complete serialized message transcript and
  memory-maintenance constraints.
