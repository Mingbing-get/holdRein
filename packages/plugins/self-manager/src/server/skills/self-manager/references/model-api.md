# Model API

Use these APIs when viewing or managing model providers, provider models, API
keys, and local model proxies. Call them through `requestSelfApi`.

## GET /api/v1/model-providers

Lists model providers. Includes a local proxy provider when local model proxies
exist.

Returns:

- `ModelProviderSummary[]`
- Provider summaries include provider id, API key presence, source, and model
  count when known.

## POST /api/v1/model-providers/custom

Creates a custom model provider.

Body:

- `provider`: Stable custom provider id.
- `baseUrl`: Base URL for the provider-compatible API.

Returns:

- Created provider summary.

## PUT /api/v1/model-providers/custom/:provider

Updates a custom model provider.

Path parameters:

- `provider`: Existing custom provider id.

Body:

- `provider`: New provider id to store.
- `baseUrl`: New base URL for the provider-compatible API.

Returns:

- Updated provider summary, or `notFound` when the custom provider is unknown.

## DELETE /api/v1/model-providers/custom/:provider

Deletes a custom model provider.

Path parameters:

- `provider`: Custom provider id to delete.

Returns:

- `{ provider: string }`.

## GET /api/v1/model-providers/:provider/models

Lists models for a provider.

Path parameters:

- `provider`: Provider id. Use `local` for local proxy models when available.

Returns:

- `ModelSummary[]`.

## POST /api/v1/model-providers/:provider/models

Creates a model under a custom provider.

Path parameters:

- `provider`: Custom provider id that owns the model.

Body:

- `api`: API protocol or model API family used by the model.
- `modelId`: Stable provider model id.
- `name`: Human-readable display name.
- `input`: Supported input modalities, such as text or image.
- `contextWindow`: Maximum context window in tokens.
- `maxTokens`: Maximum output tokens.
- `reasoning`: Whether the model supports reasoning controls.

Returns:

- Created model summary.

## PUT /api/v1/model-providers/:provider/models/:modelId

Updates a custom provider model.

Path parameters:

- `provider`: Custom provider id that owns the model.
- `modelId`: Existing model id to update.

Body:

- `api`: API protocol or model API family used by the model.
- `name`: Human-readable display name.
- `input`: Supported input modalities, such as text or image.
- `contextWindow`: Maximum context window in tokens.
- `maxTokens`: Maximum output tokens.
- `reasoning`: Whether the model supports reasoning controls.

Returns:

- Updated model summary, or `notFound` when the model is unknown.

## DELETE /api/v1/model-providers/:provider/models/:modelId

Deletes a custom provider model.

Path parameters:

- `provider`: Custom provider id that owns the model.
- `modelId`: Model id to delete.

Returns:

- `{ provider: string; modelId: string }`.

## PUT /api/v1/model-providers/:provider/api-key

Stores or replaces a provider API key.

Path parameters:

- `provider`: Provider id whose key should be stored.

Body:

- `apiKey`: The provider API key to store.

Returns:

- `{ provider: string; hasApiKey: boolean }`.

## GET /api/v1/model-proxies

Lists configured model proxies.

Returns:

- `ModelProxySummary[]`.

## POST /api/v1/model-proxies

Creates a local model proxy.

Body:

- Model proxy request input. Include the proxy model id and upstream settings
  expected by the model proxy service.

Returns:

- Created model proxy summary.

## GET /api/v1/model-proxies/:modelId

Reads one model proxy.

Path parameters:

- `modelId`: Proxy model id to read.

Returns:

- Model proxy summary.

## PUT /api/v1/model-proxies/:modelId

Updates one model proxy.

Path parameters:

- `modelId`: Proxy model id to update.

Body:

- Model proxy request input with replacement proxy settings.

Returns:

- Updated model proxy summary, or `notFound` when unknown.

## DELETE /api/v1/model-proxies/:modelId

Deletes one model proxy.

Path parameters:

- `modelId`: Proxy model id to delete.

Returns:

- `{ modelId: string }`.
