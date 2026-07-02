# Cron Chinese Time Periods Design

## Goal

Make Chinese cron descriptions use the application's expected wording for
midnight and late-evening times while preserving `cronstrue` for cron parsing
and all other translation behavior.

## Design

Add one web-layer formatter as the only entry point for Chinese cron
descriptions. It calls `cronstrue` with the `zh_CN` locale, then normalizes each
Chinese time token in the generated description:

- `00:00` through `05:59` use `午夜`, with midnight represented as hour `0`.
  For example, `00:19` becomes `午夜 0:19`.
- `20:00` through `23:59` use `晚上`, retain 12-hour clock values, and pad the
  displayed hour to two digits. For example, `20:19` becomes `晚上 08:19`.
- `06:00` through `19:59` retain the existing `cronstrue` wording.

Normalization applies to every time token, including descriptions containing
multiple times or ranges. It does not inspect or rewrite the cron expression
itself.

The cron input's collapsed label, editor preview, and scheduled-task table all
use this formatter. Callers keep their current invalid-expression fallback so
the behavior change is limited to valid Chinese descriptions.

## Testing

Add focused unit tests for the formatter at the boundaries `00:19`, `05:59`,
`06:00`, `19:59`, `20:19`, and `23:59`, plus a description containing multiple
times. Existing component tests continue to cover integration with the input,
editor, and scheduled-task view.
