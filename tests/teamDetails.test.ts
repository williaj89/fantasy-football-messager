import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchTeamDetails } from '../src/teamDetails.js';
import type { StandingEntry } from '../src/leaderboard.js';

const standings: StandingEntry[] = [
  { entry: 1, entry_name: 'Team A', rank: 1, last_rank: 1, total: 100, event_total: 60 },
  { entry: 2, entry_name: 'Team B', rank: 2, last_rank: 2, total: 90, event_total: 50 },
];

const bootstrapResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      elements: [
        { id: 1, web_name: 'Haaland' },
        { id: 2, web_name: 'Salah' },
      ],
    }),
};

function picksResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}

describe('fetchTeamDetails', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches picks for each team and resolves captain names, chip, bench points, and transfer cost', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('bootstrap-static')) return Promise.resolve(bootstrapResponse);
      if (url.includes('/entry/1/')) {
        return Promise.resolve(
          picksResponse({
            active_chip: '3xc',
            entry_history: { points_on_bench: 4, event_transfers_cost: 0 },
            picks: [{ element: 1, is_captain: true, multiplier: 3 }],
          }),
        );
      }
      return Promise.resolve(
        picksResponse({
          active_chip: null,
          entry_history: { points_on_bench: 9, event_transfers_cost: 4 },
          picks: [{ element: 2, is_captain: true, multiplier: 1 }],
        }),
      );
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchTeamDetails(standings, 5);

    expect(mockFetch).toHaveBeenCalledWith('https://fantasy.premierleague.com/api/entry/1/event/5/picks/');
    expect(mockFetch).toHaveBeenCalledWith('https://fantasy.premierleague.com/api/entry/2/event/5/picks/');
    expect(result).toEqual([
      {
        entryName: 'Team A',
        captainName: 'Haaland',
        chip: 'Triple Captain',
        benchPoints: 4,
        transferCost: 0,
        squad: [{ element: 1, multiplier: 3 }],
      },
      {
        entryName: 'Team B',
        captainName: 'Salah',
        chip: null,
        benchPoints: 9,
        transferCost: 4,
        squad: [{ element: 2, multiplier: 1 }],
      },
    ]);
  });

  it('falls back to the raw chip code when it is not a known chip', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('bootstrap-static')) return Promise.resolve(bootstrapResponse);
        return Promise.resolve(
          picksResponse({
            active_chip: 'manager',
            entry_history: { points_on_bench: 0, event_transfers_cost: 0 },
            picks: [],
          }),
        );
      }),
    );

    const result = await fetchTeamDetails(standings, 5);

    expect(result[0].chip).toBe('manager');
    expect(result[0].captainName).toBeNull();
  });

  it('omits a team whose picks request is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('bootstrap-static')) return Promise.resolve(bootstrapResponse);
        if (url.includes('/entry/1/')) return Promise.resolve({ ok: false });
        return Promise.resolve(
          picksResponse({
            active_chip: null,
            entry_history: { points_on_bench: 0, event_transfers_cost: 0 },
            picks: [{ element: 2, is_captain: true, multiplier: 1 }],
          }),
        );
      }),
    );

    const result = await fetchTeamDetails(standings, 5);

    expect(result).toEqual([
      {
        entryName: 'Team B',
        captainName: 'Salah',
        chip: null,
        benchPoints: 0,
        transferCost: 0,
        squad: [{ element: 2, multiplier: 1 }],
      },
    ]);
  });

  it('returns an empty array when the bootstrap-static lookup fails entirely', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await fetchTeamDetails(standings, 5);

    expect(result).toEqual([]);
  });
});
