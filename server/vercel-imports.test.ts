/**
 * Vercel compiles api/*.ts file by file into native ESM (package.json has
 * "type": "module") without bundling, so every relative *runtime* import in
 * the function's dependency graph needs an explicit `.js` extension.
 * Type-only imports are erased and may omit it. Missing one crashes the
 * deployed function with ERR_MODULE_NOT_FOUND, so this test walks the graph.
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '..');
const IMPORT_RE = /(?:^|\n)\s*(import|export)\s+(type\s+)?([^;]*?)\s+from\s+'(\.{1,2}\/[^']+)'/g;

function runtimeImports(file: string): { spec: string; resolved: string }[] {
  const src = fs.readFileSync(file, 'utf8');
  const found: { spec: string; resolved: string }[] = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const isTypeOnly = !!m[2] || /^\{\s*(type\s+[\w$]+\s*,?\s*)+\}$/.test(m[3].trim());
    if (isTypeOnly) continue;
    const spec = m[4];
    const base = path.resolve(path.dirname(file), spec.replace(/\.js$/, ''));
    found.push({ spec, resolved: base + '.ts' });
  }
  return found;
}

describe('Vercel function import graph', () => {
  it('uses explicit .js extensions for every runtime relative import', () => {
    const missing: string[] = [];
    const seen = new Set<string>();
    const queue = [path.join(ROOT, 'api/sync.ts')];
    while (queue.length) {
      const file = queue.pop() as string;
      if (seen.has(file)) continue;
      seen.add(file);
      for (const { spec, resolved } of runtimeImports(file)) {
        if (!spec.endsWith('.js')) missing.push(`${path.relative(ROOT, file)} → '${spec}'`);
        if (fs.existsSync(resolved)) queue.push(resolved);
      }
    }
    expect(seen.size).toBeGreaterThan(3);
    expect(missing).toEqual([]);
  });
});
