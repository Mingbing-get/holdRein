# Model Proxy Design

## Goal

Users can create a model proxy that appears in chat as provider `local` with a
user-defined model name. A proxy routes agent calls to one of several configured
real models. Candidates are tried by priority: the highest-priority model is
used until one of its token limits is exhausted, then the runtime falls back to
the next available candidate.

Token usage is recorded only against the real provider and model that handled
the request. The proxy model itself is not counted in model usage charts.

## User Experience

The existing model provider settings page gains an embedded model proxy module.
The feature should not add a new top-level page or navigation item. A user can
create or edit a proxy from that module with:

- proxy model id and display name;
- ordered candidate models selected from providers that already have an API key;
- one or more token limit rules per candidate.

The chat model selector lists configured proxies under provider `local`. When a
user selects `local/<proxyModelId>`, the backend starts the agent with a real
model selected from that proxy.

If all candidates are exhausted, starting a task fails with a clear error such
as `No available model for proxy`. If a running task exhausts the active model
and no fallback is available, the current response is kept, and the next model
request fails with a clear proxy exhaustion error.

## Token Limit Rules

Each candidate model can have multiple rules. A model is available only when all
of its rules have remaining capacity.

Rules use a token budget and a rolling or calendar window:

- `hours`: rolling window such as 24 hours or 72 hours;
- `day`: current UTC day;
- `week`: current UTC week.

The first implementation will compare total tokens, where total is input plus
output. The schema leaves room to split input and output budgets later without
changing the proxy routing model.

## Backend Data Model

Add proxy tables near the existing model provider tables:

- `model_proxies`
  - `id`
  - `model_id`
  - `name`
  - `created_at`
  - `updated_at`

- `model_proxy_candidates`
  - `id`
  - `proxy_id`
  - `priority`
  - `provider`
  - `model_id`
  - `created_at`
  - `updated_at`

- `model_proxy_candidate_limits`
  - `id`
  - `candidate_id`
  - `window_type`
  - `window_hours`
  - `max_tokens`
  - `created_at`
  - `updated_at`

`model_proxy_candidates.provider` and `model_proxy_candidates.model_id` refer to
the real model identity. They are intentionally duplicated as text so both
built-in and custom provider models can be referenced.

## Backend Services

Add a `model-proxies` module with:

- repository methods for CRUD and ordered candidate retrieval;
- service validation that proxy ids do not conflict with existing local proxy
  ids, candidates exist, and each candidate provider has an API key;
- availability evaluation that reads existing `model_token_usage_hourly` rows
  for the relevant windows;
- a runtime controller that tracks the original `local/<proxyModelId>` binding,
  selects the initial real model, and switches the harness after usage events.

The availability evaluator must include usage from the current message before
deciding whether a fallback is required. It cannot rely only on flushed database
rows because token collection batches writes.

## Runtime Flow

When an agent starts:

1. If the selected provider is not `local`, keep the existing flow.
2. If the selected provider is `local`, load the proxy by model id.
3. Select the first candidate, ordered by priority, whose limit rules are all
   available.
4. Resolve that candidate to a real `Model<Api>`.
5. Construct the harness with the real model.
6. Attach a proxy runtime controller to the harness.

On each assistant `message_end`:

1. The token collector records usage for `event.message.provider` and
   `event.message.model`.
2. The proxy runtime controller receives the usage delta for the same real
   model.
3. If the active candidate has exceeded any limit, the controller selects the
   next available candidate.
4. If a fallback exists, it calls `await harness.setModel(nextModel)`.
5. The next provider request uses the fallback model.

`AgentHarness` supports `setModel(model)`, but a model change affects future
provider requests only. It does not switch an already-running streaming request.

The runtime API key callback must use the model passed to
`getApiKeyAndHeaders(model)`, not the original chat selection. This is required
because a proxy may switch from one provider to another during a run.

## API

Add versioned endpoints:

- `GET /api/v1/model-proxies`
- `POST /api/v1/model-proxies`
- `GET /api/v1/model-proxies/:modelId`
- `PUT /api/v1/model-proxies/:modelId`
- `DELETE /api/v1/model-proxies/:modelId`

`GET /api/v1/model-providers` should include provider `local` when at least one
proxy exists. `GET /api/v1/model-providers/local/models` returns the proxy
models so the existing model selector can load them like provider models.

## Frontend

The existing model providers view should add a model proxy module alongside the
current built-in and custom provider management areas. The proxy editor should
use existing Ant Design controls and theme variables. It should not hard-code
colors.

The editor needs:

- proxy name and model id fields;
- candidate rows ordered by priority;
- provider/model selectors filtered to providers with API keys;
- one or more token limit rows for each candidate.

The chat model selector should need little custom logic if the backend exposes
`local` through the existing provider and model list endpoints.

## Error Handling

Proxy validation rejects:

- duplicate proxy ids;
- unknown candidate providers or models;
- candidates whose provider has no API key;
- empty candidate lists;
- non-positive token limits;
- invalid windows.

Runtime errors are explicit:

- `Unknown proxy model` when `local/<modelId>` does not exist;
- `No available model for proxy` when every candidate is exhausted;
- `Proxy fallback unavailable` when a running task needs a fallback and none
  remains.

## Testing

Backend tests:

- repository CRUD for proxies, candidates, and limits;
- service validation and provider/model existence checks;
- availability evaluation for hours, day, and week windows;
- initial real model selection by priority;
- fallback after assistant `message_end`;
- token usage still records real provider and model only;
- API key lookup uses the currently active real model.

Frontend tests:

- local provider/proxy models appear in the selector;
- proxy editor validates required fields;
- candidate ordering and limit rows serialize correctly;
- settings view refreshes after create, update, and delete.

## Implementation Notes

Keep each new file under 500 lines. Split larger modules into folders with an
`index.ts` export. Add tests before implementation changes, matching the
project's existing Vitest patterns.
