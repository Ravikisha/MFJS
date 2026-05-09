// Lightweight cn helper — emulates clsx + tailwind-merge without an extra dep.
// For a docs site this is sufficient; switch to `clsx` + `tailwind-merge` if you
// later need full conflict resolution between Tailwind utilities.
export type ClassValue =
  | string
  | number
  | null
  | false
  | undefined
  | ClassValue[]
  | { [k: string]: boolean | undefined | null };

function flatten(input: ClassValue, out: string[]): void {
  if (!input && input !== 0) return;
  if (typeof input === 'string' || typeof input === 'number') {
    out.push(String(input));
    return;
  }
  if (Array.isArray(input)) {
    for (const item of input) flatten(item, out);
    return;
  }
  if (typeof input === 'object') {
    for (const key of Object.keys(input)) {
      if (input[key]) out.push(key);
    }
  }
}

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  for (const input of inputs) flatten(input, out);
  return out.join(' ');
}
