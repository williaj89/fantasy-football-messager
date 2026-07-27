import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLeaderboardMessage, fetchStandings, type StandingEntry } from '../src/leaderboard.js';

const standings: StandingEntry[] = [
  { entry_name: 'Team 1', rank: 1, last_rank: 4, total: 100 },
  { entry_name: 'Team 2', rank: 2, last_rank: 1, total: 90 },
  { entry_name: 'Team 3', rank: 3, last_rank: 3, total: 85 },
  { entry_name: 'Team 4', rank: 4, last_rank: 2, total: 80 },
  { entry_name: 'Team 5', rank: 5, last_rank: 5, total: 75 },
];

describe('buildLeaderboardMessage', () => {
  it('formats the sorted leaderboard with rank-change arrows', () => {
    const message = buildLeaderboardMessage(standings);

    expect(message).toBe(
      ['1. Team 1 ⬆ 3', '2. Team 2 ⬇ 1', '3. Team 3 ◀ 0', '4. Team 4 ⬇ 2', '5. Team 5 ◀ 0'].join('\n'),
    );
  });

  it('sorts by total score descending regardless of input order', () => {
    const shuffled = [standings[2], standings[0], standings[4], standings[1], standings[3]];

    expect(buildLeaderboardMessage(shuffled)).toBe(buildLeaderboardMessage(standings));
  });
});

describe('fetchStandings', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches the FPL league endpoint and extracts the standings results', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ standings: { results: standings } }),
    });
    vi.stubGlobal('fetch', mockFetch);

    const result = await fetchStandings('12345');

    expect(mockFetch).toHaveBeenCalledWith('https://fantasy.premierleague.com/api/leagues-classic/12345/standings/');
    expect(result).toEqual(standings);
  });

  it('returns an empty array when the response has no standings', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({}),
      }),
    );

    const result = await fetchStandings('12345');

    expect(result).toEqual([]);
  });
});
