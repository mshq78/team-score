import { describe, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createFileStore } from './store-file';
import { eventsSuite } from './events-suite';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'teamkeshi-events-'));
const store = createFileStore(dir);
afterAll(() => {
  store.flush();
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('multiple events (file store)', () => {
  eventsSuite(() => store);
});
