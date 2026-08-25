import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { interactions: { create: mockCreate } };
  }),
}));

import { generateGameweekSummary } from '../src/summary.js';
import type { StandingEntry } from '../src/leaderboard.js';
import type { TeamDetail } from '../src/teamDetails.js';
import type { SeasonHistory } from '../src/seasonHistory.js';
import type { PlayerPerformance } from '../src/playerPerformance.js';

const standings: StandingEntry[] = [
  { entry: 1, entry_name: 'Team A', rank: 1, last_rank: 2, total: 100, event_total: 60 },
  { entry: 2, entry_name: 'Team B', rank: 2, last_rank: 1, total: 95, event_total: 50 },
];

describe('generateGameweekSummary', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.GEMINI_API_KEY = 'test-key';
  });

  it('returns null when GEMINI_API_KEY is not set', async () => {
    delete process.env.GEMINI_API_KEY;

    const result = await generateGameweekSummary(standings, 5);

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns null when standings is empty', async () => {
    const result = await generateGameweekSummary([], 5);

    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns the generated text on success, using gemini-3.6-flash', async () => {
    mockCreate.mockResolvedValue({ output_text: 'Team A takes the crown!' });

    const result = await generateGameweekSummary(standings, 5);

    expect(result).toBe('Team A takes the crown!');
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('gemini-3.6-flash');
  });

  it('handles a null/unknown gameweek id gracefully', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });

    await generateGameweekSummary(standings, null);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.input).toContain('this gameweek');
  });

  it('returns null when the Gemini API call throws', async () => {
    mockCreate.mockRejectedValue(new Error('rate limited'));

    const result = await generateGameweekSummary(standings, 5);

    expect(result).toBeNull();
  });

  it('returns null when the response has no output text', async () => {
    mockCreate.mockResolvedValue({ output_text: undefined });

    const result = await generateGameweekSummary(standings, 5);

    expect(result).toBeNull();
  });

  it('returns null when the output text is blank', async () => {
    mockCreate.mockResolvedValue({ output_text: '   ' });

    const result = await generateGameweekSummary(standings, 5);

    expect(result).toBeNull();
  });

  it('includes gameweek score, chip, captain, bench, and transfer-hit detail when team details are provided', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });
    const teamDetails: TeamDetail[] = [
      { entryName: 'Team A', captainName: 'Haaland', chip: 'Triple Captain', benchPoints: 2, transferCost: 0, squad: [] },
      { entryName: 'Team B', captainName: 'Haaland', chip: null, benchPoints: 9, transferCost: 4, squad: [] },
    ];

    await generateGameweekSummary(standings, 5, teamDetails);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).toContain("This gameweek's scores: Team A top-scored with 60, while Team B had the week's lowest score with 50.");
    expect(prompt).toContain('Chips played: Team A used Triple Captain.');
    expect(prompt).toContain('Most popular captain: Haaland (picked by 2 teams).');
    expect(prompt).toContain('Most points left on the bench: Team B (9).');
    expect(prompt).toContain('Biggest transfer hit: Team B (-4).');
  });

  it('omits team-by-team detail lines when no team details are provided', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });

    await generateGameweekSummary(standings, 5);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).not.toContain('Chips played');
    expect(prompt).not.toContain('Most popular captain');
  });

  it('includes consistency and season-best/worst gameweek detail when season histories are provided', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });
    const seasonHistories: SeasonHistory[] = [
      {
        entryName: 'Team A',
        gameweeksPlayed: 5,
        averagePoints: 60,
        standardDeviation: 2,
        bestGameweek: { event: 3, points: 90 },
        worstGameweek: { event: 1, points: 40 },
      },
      {
        entryName: 'Team B',
        gameweeksPlayed: 5,
        averagePoints: 55,
        standardDeviation: 15,
        bestGameweek: { event: 2, points: 70 },
        worstGameweek: { event: 4, points: 20 },
      },
    ];

    await generateGameweekSummary(standings, 5, [], seasonHistories);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).toContain('Most consistent team all season: Team A (averaging 60.0 points a week with little variation).');
    expect(prompt).toContain('Biggest rollercoaster season: Team B (huge swings week to week).');
    expect(prompt).toContain('Best single gameweek all season: Team A scored 90 in Gameweek 3.');
    expect(prompt).toContain('Worst single gameweek all season: Team B managed just 20 in Gameweek 4.');
  });

  it('omits consistency detail when fewer than 3 gameweeks have been played', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });
    const seasonHistories: SeasonHistory[] = [
      {
        entryName: 'Team A',
        gameweeksPlayed: 2,
        averagePoints: 60,
        standardDeviation: 2,
        bestGameweek: { event: 2, points: 65 },
        worstGameweek: { event: 1, points: 55 },
      },
    ];

    await generateGameweekSummary(standings, 5, [], seasonHistories);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).not.toContain('Most consistent team');
    expect(prompt).toContain('Best single gameweek all season');
  });

  it('omits season history lines when none are provided', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });

    await generateGameweekSummary(standings, 5);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).not.toContain('all season');
  });

  it('includes top performer and differential detail when player performance is provided', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });
    const playerPerformance: PlayerPerformance = {
      topPerformer: { playerName: 'Haaland', points: 18, teams: ['Team A', 'Team B'] },
      bestDifferential: { playerName: 'Watkins', points: 12, entryName: 'Team B' },
    };

    await generateGameweekSummary(standings, 5, [], [], playerPerformance);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).toContain('Top individual performer: Haaland (18 pts), started by Team A & Team B.');
    expect(prompt).toContain('Best differential: Team B was the only team to start Watkins, who returned 12 points.');
  });

  it('omits the differential line when the top performer and best differential are the same player', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });
    const playerPerformance: PlayerPerformance = {
      topPerformer: { playerName: 'Watkins', points: 20, teams: ['Team B'] },
      bestDifferential: { playerName: 'Watkins', points: 20, entryName: 'Team B' },
    };

    await generateGameweekSummary(standings, 5, [], [], playerPerformance);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).toContain('Top individual performer: Watkins (20 pts), started by Team B.');
    expect(prompt).not.toContain('Best differential');
  });

  it('omits player performance lines when none are provided', async () => {
    mockCreate.mockResolvedValue({ output_text: 'recap' });

    await generateGameweekSummary(standings, 5);

    const prompt = mockCreate.mock.calls[0][0].input as string;
    expect(prompt).not.toContain('Top individual performer');
    expect(prompt).not.toContain('Best differential');
  });
});
