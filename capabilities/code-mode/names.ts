function normalize(value: string): string {
  const normalized = value
    .trim()
    .replace(/[^a-zA-Z0-9_$-]+/g, '_')
    .replace(/^[^a-zA-Z_$]+/, '_');

  return normalized || 'tool';
}

export function createCallableNames(
  toolNames: string[]
): Map<string, string> {
  const result = new Map<string, string>();
  const used = new Set<string>();

  for (const original of toolNames) {
    const base = normalize(original);
    let candidate = base;
    let counter = 2;

    while (used.has(candidate)) {
      candidate = `${base}_${counter++}`;
    }

    used.add(candidate);
    result.set(original, candidate);
  }

  return result;
}
