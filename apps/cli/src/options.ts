export function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readOptionValue(
  args: readonly string[],
  optionName: string
): string | undefined {
  const optionIndex = args.indexOf(optionName);

  if (optionIndex === -1) {
    return undefined;
  }

  const value = args[optionIndex + 1];

  if (value === undefined || value.startsWith("-")) {
    throw new Error(`Missing value for ${optionName}`);
  }

  return value;
}

export function readRepeatedOptionValues(
  args: readonly string[],
  optionName: string
): readonly string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    if (args[index] !== optionName) {
      continue;
    }

    const value = args[index + 1];

    if (value === undefined || value.startsWith("-")) {
      throw new Error(`Missing value for ${optionName}`);
    }

    values.push(value);
  }

  return values;
}
