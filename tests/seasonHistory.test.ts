import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchSeasonHistories } from '../src/seasonHistory.js';
import type { StandingEntry } from '../src/leaderboard.js';

const standings: StandingEntry[] = [
  { entry: 1, entry_name: 'Team A', rank: 1, last_rank: 1, total: 100, event_total: 60 },
  { entry: 2, entry_name: 'Team B', rank: 2, last_rank: 2, total: 90, event_total: 50 },
];

function historyResponse(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) };
}

describe('fetchSeasonHistories', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('computes average, standard deviation, and best/worst gameweek from each team\'s current-season history', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('/entry/1/')) {
        return Promise.resolve(
          historyResponse({
            current: [
              { event: 1, points: 50 },
              { event: 2, points: 70 },
            ],
          }),
        );
      }
      return Promise.resolve(
        historyResponse({
          current: [
            { event: 1, points: 40 },
            { event: 2, points: 40 },
          ],
        }),
      );
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchSeasonHistories(standings);

    expect(mockFetch).toHaveBeenCalledWith('https://fantasy.premierleague.com/api/entry/1/history/');
    expect(mockFetch).toHaveBeenCalledWith('https://fantasy.premierleague.com/api/entry/2/history/');
    expect(result).toEqual([
      {
        entryName: 'Team A',
        gameweeksPlayed: 2,
        averagePoints: 60,
        standardDeviation: 10,
        bestGameweek: { event: 2, points: 70 },
        worstGameweek: { event: 1, points: 50 },
      },
      {
        entryName: 'Team B',
        gameweeksPlayed: 2,
        averagePoints: 40,
        standardDeviation: 0,
        bestGameweek: { event: 1, points: 40 },
        worstGameweek: { event: 1, points: 40 },
      },
    ]);
  });

  it('omits a team whose history request is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/entry/1/')) return Promise.resolve({ ok: false });
        return Promise.resolve(historyResponse({ current: [{ event: 1, points: 40 }] }));
      }),
    );

    const result = await fetchSeasonHistories(standings);

    expect(result).toEqual([
      {
        entryName: 'Team B',
        gameweeksPlayed: 1,
        averagePoints: 40,
        standardDeviation: 0,
        bestGameweek: { event: 1, points: 40 },
        worstGameweek: { event: 1, points: 40 },
      },
    ]);
  });

  it('omits a team with no current-season gameweeks played', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url.includes('/entry/1/')) return Promise.resolve(historyResponse({ current: [] }));
        return Promise.resolve(historyResponse({ current: [{ event: 1, points: 40 }] }));
      }),
    );

    const result = await fetchSeasonHistories(standings);

    expect(result).toEqual([
      {
        entryName: 'Team B',
        gameweeksPlayed: 1,
        averagePoints: 40,
        standardDeviation: 0,
        bestGameweek: { event: 1, points: 40 },
        worstGameweek: { event: 1, points: 40 },
      },
    ]);
  });

  it('returns an empty array when every request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await fetchSeasonHistories(standings);

    expect(result).toEqual([]);
  });
});
