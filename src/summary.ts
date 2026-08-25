import { GoogleGenAI } from '@google/genai';
import type { StandingEntry } from './leaderboard.js';
import type { TeamDetail } from './teamDetails.js';
import type { SeasonHistory } from './seasonHistory.js';
import type { PlayerPerformance } from './playerPerformance.js';

const SYSTEM_PROMPT = `You are writing a short, fun recap of a Fantasy Premier League mini-league table for a private WhatsApp group chat of friends. Your tone is witty, warm, and a little cheeky — like a friend texting the group, not a sports broadcaster. Keep it to 2-4 short sentences. No hashtags, no emoji spam (one or two is fine if it fits naturally), no headings, no bullet points — just plain conversational text. Do not repeat the full table; the table will be sent separately right after your message. Focus on the story: who's on top, who's rising, who's falling, and anything close or dramatic. You'll also be given team-by-team detail (captains, chips, bench points, transfer hits), season-long stats (consistency, best/worst single gameweek), and individual player performances (top performer, best differential) — pick out whichever one or two details make the best story rather than listing them all.`;

function buildTeamDetailLines(teamDetails: TeamDetail[]): string[] {
  if (teamDetails.length === 0) {
    return [];
  }

  const lines: string[] = [];

  const chipsPlayed = teamDetails.filter((team) => team.chip !== null);
  if (chipsPlayed.length > 0) {
    lines.push(`Chips played: ${chipsPlayed.map((team) => `${team.entryName} used ${team.chip}`).join('; ')}.`);
  }

  const captainCounts = new Map<string, string[]>();
  for (const team of teamDetails) {
    if (!team.captainName) continue;
    const teams = captainCounts.get(team.captainName) ?? [];
    teams.push(team.entryName);
    captainCounts.set(team.captainName, teams);
  }
  if (captainCounts.size > 0) {
    const [topCaptain, topCaptainTeams] = [...captainCounts.entries()].sort((a, b) => b[1].length - a[1].length)[0];
    lines.push(
      `Most popular captain: ${topCaptain} (picked by ${topCaptainTeams.length} team${topCaptainTeams.length === 1 ? '' : 's'}).`,
    );
    const differentials = [...captainCounts.entries()].filter(([name]) => name !== topCaptain && captainCounts.get(name)!.length === 1);
    if (differentials.length > 0 && captainCounts.size > 1) {
      lines.push(
        `Differential captains: ${differentials.map(([name, teams]) => `${teams[0]} went with ${name}`).join('; ')}.`,
      );
    }
  }

  const maxBench = teamDetails.reduce((max, team) => (team.benchPoints > max.benchPoints ? team : max), teamDetails[0]);
  if (maxBench.benchPoints > 0) {
    lines.push(`Most points left on the bench: ${maxBench.entryName} (${maxBench.benchPoints}).`);
  }

  const maxHit = teamDetails.reduce((max, team) => (team.transferCost > max.transferCost ? team : max), teamDetails[0]);
  if (maxHit.transferCost > 0) {
    lines.push(`Biggest transfer hit: ${maxHit.entryName} (-${maxHit.transferCost}).`);
  }

  return lines;
}

function buildSeasonHistoryLines(seasonHistories: SeasonHistory[]): string[] {
  if (seasonHistories.length === 0) {
    return [];
  }

  const lines: string[] = [];

  const eligible = seasonHistories.filter((team) => team.gameweeksPlayed >= 3);
  if (eligible.length > 0) {
    const mostConsistent = eligible.reduce(
      (min, team) => (team.standardDeviation < min.standardDeviation ? team : min),
      eligible[0],
    );
    const mostVolatile = eligible.reduce(
      (max, team) => (team.standardDeviation > max.standardDeviation ? team : max),
      eligible[0],
    );
    lines.push(
      `Most consistent team all season: ${mostConsistent.entryName} (averaging ${mostConsistent.averagePoints.toFixed(1)} points a week with little variation).`,
    );
    if (mostVolatile.entryName !== mostConsistent.entryName) {
      lines.push(`Biggest rollercoaster season: ${mostVolatile.entryName} (huge swings week to week).`);
    }
  }

  const seasonBest = seasonHistories.reduce(
    (max, team) => (team.bestGameweek.points > max.bestGameweek.points ? team : max),
    seasonHistories[0],
  );
  lines.push(
    `Best single gameweek all season: ${seasonBest.entryName} scored ${seasonBest.bestGameweek.points} in Gameweek ${seasonBest.bestGameweek.event}.`,
  );

  const seasonWorst = seasonHistories.reduce(
    (min, team) => (team.worstGameweek.points < min.worstGameweek.points ? team : min),
    seasonHistories[0],
  );
  lines.push(
    `Worst single gameweek all season: ${seasonWorst.entryName} managed just ${seasonWorst.worstGameweek.points} in Gameweek ${seasonWorst.worstGameweek.event}.`,
  );

  return lines;
}

function buildPlayerPerformanceLines(playerPerformance: PlayerPerformance): string[] {
  const lines: string[] = [];

  const { topPerformer, bestDifferential } = playerPerformance;
  if (topPerformer) {
    lines.push(
      `Top individual performer: ${topPerformer.playerName} (${topPerformer.points} pts), started by ${topPerformer.teams.join(' & ')}.`,
    );
  }
  if (bestDifferential && bestDifferential.playerName !== topPerformer?.playerName) {
    lines.push(
      `Best differential: ${bestDifferential.entryName} was the only team to start ${bestDifferential.playerName}, who returned ${bestDifferential.points} points.`,
    );
  }

  return lines;
}

function buildUserPrompt(
  standings: StandingEntry[],
  gameweekId: number | null,
  teamDetails: TeamDetail[],
  seasonHistories: SeasonHistory[],
  playerPerformance: PlayerPerformance,
): string {
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

  const byGameweekScore = [...standings].sort((a, b) => b.event_total - a.event_total);
  const bestScorer = byGameweekScore[0];
  const worstScorer = byGameweekScore[byGameweekScore.length - 1];
  const gameweekScoreLine =
    bestScorer.entry_name !== worstScorer.entry_name
      ? `This gameweek's scores: ${bestScorer.entry_name} top-scored with ${bestScorer.event_total}, while ${worstScorer.entry_name} had the week's lowest score with ${worstScorer.event_total}.`
      : '';

  const lines = [
    `Here's the state of our FPL mini-league for ${gameweekLabel}:`,
    '',
    `Current leader: ${leader.entry_name}`,
    riserDelta > 0 ? `Biggest riser: ${riser.entry_name} (up ${riserDelta} place${riserDelta === 1 ? '' : 's'})` : '',
    fallerDelta > 0 ? `Biggest faller: ${faller.entry_name} (down ${fallerDelta} place${fallerDelta === 1 ? '' : 's'})` : '',
    closestGapLine,
    tieLine,
    gameweekScoreLine,
    ...buildTeamDetailLines(teamDetails),
    ...buildSeasonHistoryLines(seasonHistories),
    ...buildPlayerPerformanceLines(playerPerformance),
    '',
    'Write the recap now.',
  ].filter((line) => line !== '');

  return lines.join('\n');
}

const NO_PLAYER_PERFORMANCE: PlayerPerformance = { topPerformer: null, bestDifferential: null };

export async function generateGameweekSummary(
  standings: StandingEntry[],
  gameweekId: number | null,
  teamDetails: TeamDetail[] = [],
  seasonHistories: SeasonHistory[] = [],
  playerPerformance: PlayerPerformance = NO_PLAYER_PERFORMANCE,
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
      input: buildUserPrompt(standings, gameweekId, teamDetails, seasonHistories, playerPerformance),
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
