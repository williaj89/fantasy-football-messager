import { afterEach, describe, expect, it, vi } from 'vitest';
import { computePlayerPerformance } from '../src/playerPerformance.js';
import type { TeamDetail } from '../src/teamDetails.js';

const teamDetails: TeamDetail[] = [
  {
    entryName: 'Team A',
    captainName: 'Haaland',
    chip: null,
    benchPoints: 0,
    transferCost: 0,
    squad: [
      { element: 1, multiplier: 2 }, // Haaland, captained
      { element: 2, multiplier: 1 }, // Salah
      { element: 3, multiplier: 0 }, // benched Watkins
    ],
  },
  {
    entryName: 'Team B',
    captainName: 'Haaland',
    chip: null,
    benchPoints: 0,
    transferCost: 0,
    squad: [
      { element: 1, multiplier: 2 }, // Haaland, also captained
      { element: 3, multiplier: 1 }, // Watkins, started
    ],
  },
];

const bootstrapResponse = {
  ok: true,
  json: () =>
    Promise.resolve({
      elements: [
        { id: 1, web_name: 'Haaland' },
        { id: 2, web_name: 'Salah' },
        { id: 3, web_name: 'Watkins' },
      ],
    }),
};

function liveResponse(elements: { id: number; points: number }[]) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        elements: elements.map(({ id, points }) => ({ id, stats: { total_points: points } })),
      }),
  };
}

function stubFetch(live: { id: number; points: number }[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      if (url.includes('bootstrap-static')) return Promise.resolve(bootstrapResponse);
      return Promise.resolve(liveResponse(live));
    }),
  );
}

describe('computePlayerPerformance', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('finds the top individual performer among starters, across all teams', async () => {
    stubFetch([
      { id: 1, points: 18 },
      { id: 2, points: 6 },
      { id: 3, points: 10 },
    ]);

    const result = await computePlayerPerformance(teamDetails, 5);

    expect(result.topPerformer).toEqual({ playerName: 'Haaland', points: 18, teams: ['Team A', 'Team B'] });
  });

  it('finds the best differential: the highest-scoring player started by exactly one team', async () => {
    stubFetch([
      { id: 1, points: 18 },
      { id: 2, points: 6 },
      { id: 3, points: 14 },
    ]);

    const result = await computePlayerPerformance(teamDetails, 5);

    // Salah (element 2) is Team A's only unique starter; Watkins (element 3) is started only by
    // Team B (Team A's copy is benched, multiplier 0). Watkins outscores Salah.
    expect(result.bestDifferential).toEqual({ playerName: 'Watkins', points: 14, entryName: 'Team B' });
  });

  it('ignores benched players (multiplier 0) when computing ownership', async () => {
    stubFetch([
      { id: 1, points: 5 },
      { id: 2, points: 5 },
      { id: 3, points: 99 },
    ]);

    const result = await computePlayerPerformance(teamDetails, 5);

    // Watkins scored huge, but Team A's copy was benched — only Team B started him, so he's
    // both the top performer and the best differential.
    expect(result.topPerformer).toEqual({ playerName: 'Watkins', points: 99, teams: ['Team B'] });
    expect(result.bestDifferential).toEqual({ playerName: 'Watkins', points: 99, entryName: 'Team B' });
  });

  it('returns null performance when there are no teams', async () => {
    const result = await computePlayerPerformance([], 5);

    expect(result).toEqual({ topPerformer: null, bestDifferential: null });
  });

  it('returns null performance when the live stats lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const result = await computePlayerPerformance(teamDetails, 5);

    expect(result).toEqual({ topPerformer: null, bestDifferential: null });
  });
});
