# ts-standards Validator Message Scope Design

## Problem

The validator currently scopes changed-file detection after the latest
`ts-standards-validator` custom message, but it labels the current run's
`runInput.prompt` as the original task. If a run is interrupted and the user
later sends a continuation such as `继续`, the validator loses the earlier
task message even though changes from both runs belong to the same unvalidated
work.

## Message Window

For each validator invocation:

1. Find the latest custom message whose agent name is
   `ts-standards-validator`.
2. Inspect messages after that marker, or the full history when no marker
   exists.
3. Use every message after that marker as the current validation window.

The validation window is not scoped by user messages. This ensures a second
validation can inspect corrections made after a failed validator result even
when the user has not sent another message.

## Original Task

Collect text from every non-empty user message in the validation window,
preserving message order. Support both string content and text entries in
structured user content. Trim surrounding whitespace, ignore empty text and
non-text entries, and join the resulting messages with newline characters.

The joined text becomes the validator prompt's `Original task` section. If the
validation window contains no non-empty user text, use the latest non-empty user
message from the full history and append the latest validator result. This
fallback gives a second validator both the original user task and the previous
validation findings.

## Changed Files

Changed-file extraction uses the same validation window. Existing tool-call and
successful tool-result matching, path deduplication, and operation detection
remain unchanged.

## Testing

Add regression coverage for:

- an interrupted task followed by a non-empty continuation message;
- all non-empty user messages appearing in `Original task`, joined by newlines;
- changes made across the messages since the previous validator invocation;
- empty user messages not starting a validation window or appearing in the
  original task;
- structured user text content.
