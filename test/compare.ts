export function firstDifference(a: unknown, b: unknown, path = ''): string {
  const fields = (x: unknown) =>
    x !== null && typeof x === 'object' ? new Map(Object.entries(x)) : undefined
  const left = fields(a)
  const right = fields(b)
  return JSON.stringify(a) === JSON.stringify(b)
    ? ''
    : left !== undefined &&
        right !== undefined &&
        Array.isArray(a) === Array.isArray(b)
      ? ([...new Set([...left.keys(), ...right.keys()])]
          .map(key =>
            firstDifference(left.get(key), right.get(key), `${path}.${key}`),
          )
          .find(found => found !== '') ?? `${path}: keys in another order`)
      : `${path}: ${String(JSON.stringify(a)).slice(0, 300)} against ${String(JSON.stringify(b)).slice(0, 300)}`
}

export function sortedKeys(value: unknown): unknown {
  return Array.isArray(value)
    ? value.map(sortedKeys)
    : value !== null && typeof value === 'object'
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, field]) => [key, sortedKeys(field)]),
        )
      : value
}
