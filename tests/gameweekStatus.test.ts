import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchCurrentGameweekStatus, isFinalized, type GameweekStatus } from '../src/gameweekStatus.js';

describe('fetchCurrentGameweekStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the current gameweek status when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            events: [
              { id: 4, is_current: false, finished: true, data_checked: true },
              { id: 5, is_current: true, finished: false, data_checked: false },
            ],
          }),
      }),
    );

    expect(await fetchCurrentGameweekStatus()).toEqual({ id: 5, finished: false, dataChecked: false });
  });

  it('returns null when there is no current gameweek (off-season)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ events: [] }),
      }),
    );

    expect(await fetchCurrentGameweekStatus()).toBeNull();
  });

  it('returns null when the response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));

    expect(await fetchCurrentGameweekStatus()).toBeNull();
  });

  it('returns null when the response is not valid JSON (maintenance mode)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.reject(new SyntaxError('Unexpected token <')),
      }),
    );

    expect(await fetchCurrentGameweekStatus()).toBeNull();
  });

  it('returns null when fetch itself rejects', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    expect(await fetchCurrentGameweekStatus()).toBeNull();
  });
});

describe('isFinalized', () => {
  it('is true only when both finished and dataChecked are true', () => {
    const finalized: GameweekStatus = { id: 1, finished: true, dataChecked: true };
    const notFinished: GameweekStatus = { id: 1, finished: false, dataChecked: true };
    const notChecked: GameweekStatus = { id: 1, finished: true, dataChecked: false };

    expect(isFinalized(finalized)).toBe(true);
    expect(isFinalized(notFinished)).toBe(false);
    expect(isFinalized(notChecked)).toBe(false);
    expect(isFinalized(null)).toBe(false);
  });
});
