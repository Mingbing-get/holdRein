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
3. Find the first user message in that range that contains non-whitespace text.
4. Use that user message and every later message as the current validation
   window.

Messages before the first non-empty user message are excluded so work already
associated with the previous validation cycle cannot leak into the next one.
If no non-empty user message exists, the window is empty and validation does
not run.

## Original Task

Collect text from every non-empty user message in the validation window,
preserving message order. Support both string content and text entries in
structured user content. Trim surrounding whitespace, ignore empty text and
non-text entries, and join the resulting messages with newline characters.

The joined text becomes the validator prompt's `Original task` section.

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

