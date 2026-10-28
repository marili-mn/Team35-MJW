// Structural diff of two JSON documents, grouped by key path (array indexes collapsed to []).
export function deepDiff(before, after) {
  const groups = { added: new Map(), removed: new Map(), changed: new Map() };
  const bump = (kind, path, sample) => {
    const key = path.replace(/\[\d+\]/g, "[]");
    const entry = groups[kind].get(key) || { count: 0, sample };
    entry.count++;
    groups[kind].set(key, entry);
  };
  (function walk(a, b, path) {
    if (a === b) return;
    const bothObjects = a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b);
    if (!bothObjects) {
      if (a === undefined) bump("added", path, b);
      else if (b === undefined) bump("removed", path, a);
      else bump("changed", path, `${JSON.stringify(a)} -> ${JSON.stringify(b)}`);
      return;
    }
    if (Array.isArray(a)) {
      for (let i = 0; i < Math.max(a.length, b.length); i++) walk(a[i], b[i], `${path}[${i}]`);
      return;
    }
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], `${path}.${k}`);
  })(before, after, "");
  return groups;
}

export function formatDiff(groups) {
  const lines = [];
  for (const kind of ["added", "removed", "changed"]) {
    for (const [path, { count, sample }] of groups[kind]) {
      lines.push(`  ${kind.padEnd(7)} ${path} x${count}  e.g. ${String(JSON.stringify(sample)).slice(0, 90)}`);
    }
  }
  return lines;
}
