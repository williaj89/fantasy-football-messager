import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readState, serializeState, writeState } from '../src/state.js';

describe('state', () => {
  let dir: string;
  let statePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'send-state-'));
    statePath = join(dir, 'send-state.json');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns a default state when the file does not exist', async () => {
    expect(await readState(statePath)).toEqual({ lastSentGameweek: null });
  });

  it('round-trips a written state', async () => {
    await writeState(statePath, { lastSentGameweek: 7 });

    expect(await readState(statePath)).toEqual({ lastSentGameweek: 7 });
  });

  it('serializes state as pretty-printed JSON', () => {
    expect(serializeState({ lastSentGameweek: 3 })).toBe('{\n  "lastSentGameweek": 3\n}\n');
  });
});
