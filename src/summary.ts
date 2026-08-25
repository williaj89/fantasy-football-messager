import { GoogleGenAI } from '@google/genai';
import type { StandingEntry } from './leaderboard.js';

const SYSTEM_PROMPT = `You are writing a short, fun recap of a Fantasy Premier League mini-league table for a private WhatsApp group chat of friends. Your tone is witty, warm, and a little cheeky — like a friend texting the group, not a sports broadcaster. Keep it to 2-4 short sentences. No hashtags, no emoji spam (one or two is fine if it fits naturally), no headings, no bullet points — just plain conversational text. Do not repeat the full table; the table will be sent separately right after your message. Focus on the story: who's on top, who's rising, who's falling, and anything close or dramatic.`;

function buildUserPrompt(standings: StandingEntry[], gameweekId: number | null): string {
  const sorted = [...standings].sort((a, b) => b.total - a.total);
  const gameweekLabel = gameweekId != null ? `Gameweek ${gameweekId}` : 'this gameweek';

  const leader = sorted[0];

  let riser = sorted[0];
  let riserDelta = 0;
  let faller = sorted[0];
  let fallerDelta = 0;
  for (const team of sorted) {
    const delta = team.last_rank - team.rank;
    if (delta > riserDelta) {
      riser = team;
      riserDelta = delta;
    }
    if (-delta > fallerDelta) {
      faller = team;
      fallerDelta = -delta;
    }
  }

  let closestGapLine = '';
  if (sorted.length >= 2) {
    let minGap = Infinity;
    let gapA = sorted[0];
    let gapB = sorted[1];
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i].total - sorted[i + 1].total;
      if (gap < minGap) {
        minGap = gap;
        gapA = sorted[i];
        gapB = sorted[i + 1];
      }
    }
    closestGapLine = `Closest gap: only ${minGap} point${minGap === 1 ? '' : 's'} between ${gapA.entry_name} and ${gapB.entry_name}.`;
  }

  const tiedGroups = new Map<number, string[]>();
  for (const team of sorted) {
    const group = tiedGroups.get(team.total) ?? [];
    group.push(team.entry_name);
    tiedGroups.set(team.total, group);
  }
  const ties = [...tiedGroups.entries()].filter(([, names]) => names.length > 1);
  const tieLine =
    ties.length > 0
      ? `Tied on points: ${ties.map(([total, names]) => `${names.join(' & ')} (${total})`).join('; ')}.`
      : '';

  const lines = [
    `Here's the state of our FPL mini-league for ${gameweekLabel}:`,
    '',
    `Current leader: ${leader.entry_name}`,
    riserDelta > 0 ? `Biggest riser: ${riser.entry_name} (up ${riserDelta} place${riserDelta === 1 ? '' : 's'})` : '',
    fallerDelta > 0 ? `Biggest faller: ${faller.entry_name} (down ${fallerDelta} place${fallerDelta === 1 ? '' : 's'})` : '',
    closestGapLine,
    tieLine,
    '',
    'Write the recap now.',
  ].filter((line) => line !== '');

  return lines.join('\n');
}

export async function generateGameweekSummary(
  standings: StandingEntry[],
  gameweekId: number | null,
): Promise<string | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (standings.length === 0) {
    return null;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const interaction = await ai.interactions.create({
      model: 'gemini-3.6-flash',
      input: buildUserPrompt(standings, gameweekId),
      system_instruction: SYSTEM_PROMPT,
      generation_config: { max_output_tokens: 1000, thinking_level: 'minimal' },
    });

    const text = interaction.output_text?.trim() ?? '';
    return text.length > 0 ? text : null;
  } catch (error) {
    console.warn('Failed to generate AI gameweek summary, falling back to plain leaderboard:', error);
    return null;
  }
}
