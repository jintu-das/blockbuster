/** FNV-1a 32-bit string hash. */
function hash(text: string) {
  let value = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 0x01000193);
  }
  return value >>> 0;
}

/**
 * A random-looking order that depends only on `seed`, `salt` and each item's id. Refetching the
 * same items keeps their order; new items slot in without reshuffling the rest. Use a different
 * `salt` per list to give each list its own order from one seed.
 */
export function seededOrder<T extends { id: string }>(items: readonly T[], seed: number, salt: string): T[] {
  const rank = (item: T) => hash(`${seed}:${salt}:${item.id}`);
  return [...items].sort((a, b) => rank(a) - rank(b));
}
