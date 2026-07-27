import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreate = vi.fn();

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAIMock() {
    return { interactions: { create: mockCreate } };
  }),
}));

import { generateGameweekSummary } from '../src/summary.js';
import type { StandingEntry } from '../src/leaderboard.js';

const standings: StandingEntry[] = [
  { entry_name: 'Team A', rank: 1, last_rank: 2, total: 100 },
  { entry_name: 'Team B', rank: 2, last_rank: 1, total: 95 },
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
});
