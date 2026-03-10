export interface DiffEntry {
  path: string;
  type: "added" | "removed" | "changed";
  before?: unknown;
  after?: unknown;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toPath(parent: string, key: string): string {
  return parent ? `${parent}.${key}` : key;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function diffObjects(previous: unknown, current: unknown, parentPath = ""): DiffEntry[] {
  if (sameValue(previous, current)) return [];

  if (!isObject(previous) || !isObject(current)) {
    return [{ path: parentPath || "(root)", type: "changed", before: previous, after: current }];
  }

  const out: DiffEntry[] = [];
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);

  for (const key of [...keys].sort()) {
    const path = toPath(parentPath, key);
    const hasPrev = Object.prototype.hasOwnProperty.call(previous, key);
    const hasCurr = Object.prototype.hasOwnProperty.call(current, key);

    if (!hasPrev && hasCurr) {
      out.push({ path, type: "added", after: current[key] });
      continue;
    }

    if (hasPrev && !hasCurr) {
      out.push({ path, type: "removed", before: previous[key] });
      continue;
    }

    out.push(...diffObjects(previous[key], current[key], path));
  }

  return out;
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  const json = JSON.stringify(value);
  if (!json) return String(value);
  return json.length > 120 ? `${json.slice(0, 117)}...` : json;
}

export function formatDiff(entries: DiffEntry[]): string {
  if (entries.length === 0) {
    return "No changes detected between previous and current REPO.json.";
  }

  const lines = ["REPO.json changes:"];
  for (const entry of entries) {
    if (entry.type === "added") {
      lines.push(`+ ${entry.path}: ${formatValue(entry.after)}`);
    } else if (entry.type === "removed") {
      lines.push(`- ${entry.path}: ${formatValue(entry.before)}`);
    } else {
      lines.push(`~ ${entry.path}: ${formatValue(entry.before)} -> ${formatValue(entry.after)}`);
    }
  }

  return lines.join("\n");
}
