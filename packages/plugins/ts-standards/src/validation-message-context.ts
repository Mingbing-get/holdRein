export function scopeValidationMessages(
  messages: readonly unknown[],
  validatorAgentName: string
): readonly unknown[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (getCustomMessageAgentName(messages[index]) === validatorAgentName) {
      return messages.slice(index + 1);
    }
  }

  return messages;
}

export function extractOriginalPrompt(
  validationMessages: readonly unknown[],
  allMessages: readonly unknown[],
  validatorAgentName: string
): string {
  const validationUserText = extractUserMessageText(validationMessages);
  if (validationUserText.length > 0) {
    return validationUserText;
  }

  return [
    findLatestUserMessageText(allMessages),
    findLatestCustomMessageText(allMessages, validatorAgentName)
  ].filter((text): text is string => text !== undefined).join("\n");
}

function extractUserMessageText(messages: readonly unknown[]): string {
  return messages.flatMap((message) => {
    const text = getUserMessageText(message);
    return text === undefined ? [] : [text];
  }).join("\n");
}

function findLatestUserMessageText(
  messages: readonly unknown[]
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const text = getUserMessageText(messages[index]);
    if (text !== undefined) {
      return text;
    }
  }

  return undefined;
}

function findLatestCustomMessageText(
  messages: readonly unknown[],
  agentName: string
): string | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (getCustomMessageAgentName(message) === agentName && isRecord(message)) {
      return getTextContent(message.content);
    }
  }

  return undefined;
}

function getUserMessageText(message: unknown): string | undefined {
  if (!isRecord(message) || message.role !== "user") {
    return undefined;
  }

  return getTextContent(message.content);
}

function getTextContent(content: unknown): string | undefined {
  const textParts = typeof content === "string"
    ? [content]
    : Array.isArray(content)
      ? content.flatMap((entry) =>
          isRecord(entry) && typeof entry.text === "string" ? [entry.text] : []
        )
      : [];
  const text = textParts
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("\n");

  return text.length === 0 ? undefined : text;
}

function getCustomMessageAgentName(message: unknown): string | undefined {
  if (!isRecord(message) || message.role !== "custom" || !isRecord(message.details)) {
    return undefined;
  }

  return typeof message.details.agentName === "string"
    ? message.details.agentName
    : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
