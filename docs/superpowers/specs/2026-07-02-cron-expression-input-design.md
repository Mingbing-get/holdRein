# Cron Expression Input Design

## Goal

Add a reusable `CronExpressionInput` under `apps/web/src/components`. The
collapsed component is a single read-only input containing a Chinese
description of a five-field cron expression. Clicking it opens a visual editor
that lets users build the supported expression without typing cron syntax.

The editor optimizes for direct selection rather than preservation of the
original cron notation. Ranges and steps are expanded into selected values, so
editing and saving an expression may change its text while preserving its
execution behavior.

## Scope

- Generate and edit standard five-field expressions in this order: minute,
  hour, day of month, month, day of week.
- Do not expose seconds or generate six-field expressions.
- Support `*`, individual numeric values, comma lists, ranges, and steps when
  parsing an existing expression.
- Generate only `*` and sorted comma-separated numeric values.
- Do not allow day-of-month and day-of-week constraints in the same expression.
- Use `cronstrue` with the existing `zh_CN` locale for the collapsed label and
  editor preview.

## User Experience

### Collapsed Control

The public control renders one Ant Design `Input`:

- It is read-only and cannot accept typed text.
- Its value is the `cronstrue` Chinese translation of the confirmed cron value.
- An expand icon in the suffix communicates that the field opens an editor.
- Clicking anywhere on the input opens the editor.
- An empty value shows `请选择执行周期` as the placeholder.
- An invalid or unsupported value shows `无法识别的执行周期` without replacing
  the supplied value.
- Disabled, validation status, blur, and form-controlled behavior follow normal
  Ant Design input conventions.

### Editor Popover

The editor appears in a popover anchored to the input. On narrow screens it may
use responsive sizing, but it remains the same editing surface rather than a
separate workflow.

At the top, an Ant Design `Segmented` control selects the highest scheduling
unit:

- 分钟
- 小时
- 天
- 周
- 月

Only fields relevant to the selected frequency are rendered. Irrelevant fields
are absent from the DOM and become `*` in the generated expression.

| Frequency | Visible fields, highest to lowest | Forced wildcard fields |
| --- | --- | --- |
| 分钟 | minute | hour, day of month, month, day of week |
| 小时 | hour, minute | day of month, month, day of week |
| 天 | day of month, hour, minute | month, day of week |
| 周 | day of week, hour, minute | day of month, month |
| 月 | month, day of month, hour, minute | day of week |

Changing frequency clears fields that are not valid for the new frequency.
Hidden selections must never leak into the generated expression.

The bottom of the editor displays the generated expression and its `cronstrue`
translation, followed by `取消` and `确定` actions. Changes remain draft state
until confirmation. Canceling, dismissing, or pressing Escape discards the
draft and keeps the controlled value unchanged.

## Field Selection

Each visible field displays every permitted value as a compact button grid:

| Field | Values | Labels |
| --- | --- | --- |
| minute | 0-59 | two-digit numbers |
| hour | 0-23 | two-digit numbers |
| day of month | 1-31 | numbers |
| month | 1-12 | Chinese month names |
| day of week | 1-7 | 周一 through 周日 |

Selection behavior is uniform:

- Clicking an unselected value selects it.
- Clicking a selected value removes it.
- No selected values means any value and serializes as `*`.
- Selecting every value is normalized to no selections and serializes as `*`.
- Selected values are unique and sorted numerically.
- The field header visibly says `任意` when its selection is empty; this avoids
  making an empty-looking grid ambiguous.
- Buttons expose pressed state to assistive technology and support keyboard
  activation.

The editor does not expose range or step controls. For example, `*/15` parses
to minute selections `0, 15, 30, 45` and saves as `0,15,30,45`.

## Expression Model

```ts
export type CronFrequency = "minute" | "hour" | "day" | "week" | "month";

export interface CronSelection {
  frequency: CronFrequency;
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}
```

Empty arrays represent wildcards. The parser and serializer are pure functions
separate from React so their boundary behavior can be tested directly.

Frequency inference for an existing expression uses the highest constrained
field:

1. A constrained month selects `month`.
2. Otherwise, a constrained day of week selects `week`.
3. Otherwise, a constrained day of month selects `day`.
4. Otherwise, a constrained hour selects `hour`.
5. Otherwise, select `minute`.

If day of month and day of week are both constrained, parsing returns an
unsupported result. This intentionally avoids the differing AND/OR semantics
of the scheduling and next-run libraries currently used by the API.

## Parsing And Serialization

The parser accepts numeric wildcard, list, range, and step forms supported by
the current scheduler. Each field is expanded to its final finite value set.
Overlapping fragments are naturally deduplicated. Values outside a field's
domain, malformed fragments, six-field input, or simultaneous day and weekday
constraints produce a typed parse error.

The serializer:

1. Applies the frequency visibility rules and forces hidden fields to `*`.
2. Sorts and deduplicates each visible selection.
3. Emits `*` for an empty or complete field selection.
4. Emits a comma-separated number list for every other selection.
5. Joins the five fields with one space.

The component preserves unsupported external values until the user deliberately
chooses a frequency and confirms a replacement. It never silently rewrites an
unparseable controlled value.

## Public API

```ts
export interface CronExpressionInputProps {
  value?: string;
  disabled?: boolean;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  status?: "error" | "warning";
}
```

The component is exported from its local `index.ts` and is compatible with
Ant Design `Form.Item` controlled field conventions.

## Component Boundaries

```text
apps/web/src/components/cronExpressionInput/
  cron-expression-input.tsx
  cron-expression-editor.tsx
  cron-field-selector.tsx
  cron-expression.ts
  cron-expression-types.ts
  cron-expression-input.css
  cron-expression-input.test.tsx
  cron-expression.test.ts
  index.ts
```

- `CronExpressionInput` owns the read-only input, translation, popover, and
  controlled value boundary.
- `CronExpressionEditor` owns frequency selection, draft state, preview, and
  confirmation.
- `CronFieldSelector` owns one accessible value grid.
- `cron-expression.ts` owns pure parsing, expansion, inference, validation, and
  serialization.

Files must remain below 500 lines. Public TypeScript types are explicit.

## Styling And Theme

Use Ant Design controls and existing theme behavior. Any custom colors must be
added to the central theme file for both light and dark modes under the
`--app-*` namespace. The component CSS may consume those variables but must not
branch on theme mode or contain hard-coded color values.

Value buttons have stable dimensions so selected state does not shift the grid.
Minute and hour grids wrap responsively without horizontal overflow, and labels
must remain readable at narrow widths.

## Validation And Errors

- Invalid controlled values render a stable fallback label and an editor error;
  they do not throw during render.
- Confirmation is disabled while the draft cannot produce a valid expression.
- An impossible calendar combination may still be syntactically valid cron;
  the component validates cron syntax and domains, not future calendar
  existence.
- Translation failures are caught and shown as the fallback label.

## Tests

Pure utility tests cover:

- Parsing and serializing each frequency.
- Expansion of ranges, wildcard steps, bounded steps, and overlapping lists.
- Sorting, deduplication, and all-values-to-wildcard normalization.
- Frequency inference.
- Five-field validation and rejection of six-field expressions.
- Rejection of simultaneous day-of-month and day-of-week constraints.
- Domain and syntax errors.

Component tests cover:

- Read-only translated display and placeholder behavior.
- Opening, dismissing, canceling, and confirming the editor.
- Frequency-specific field visibility, including absence from the DOM.
- Clearing selections hidden by a frequency change.
- Toggle selection and the empty-is-any rule.
- Draft isolation from `onChange` until confirmation.
- Controlled updates, disabled state, validation status, and `Form.Item` use.
- Accessible pressed state and keyboard activation.

## Integration

The scheduled-task form replaces its raw cron text input with
`CronExpressionInput`. No API contract or database schema changes are required;
the form continues submitting the generated expression through
`cronExpression`.
