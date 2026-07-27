import 'dotenv/config';
import { buildLeaderboardMessage, fetchStandings } from './leaderboard.js';
import { connect, resolveGroupJid, sendGroupMessage } from './whatsapp.js';
import { fetchCurrentGameweekStatus, isFinalized, type GameweekStatus } from './gameweekStatus.js';
import { readState, writeState } from './state.js';
import { generateGameweekSummary } from './summary.js';

const STATE_PATH = process.env.SEND_STATE_PATH ?? 'send-state.json';

export async function main(): Promise<void> {
  const leagueId = process.env.LEAGUE_ID;
  const groupInviteCode = process.env.WHATSAPP_GROUP_INVITE_CODE;
  // Manual/local testing only — bypasses the finalization and already-sent checks so
  // the send pipeline can be verified before a gameweek is actually finalized. Never
  // set in the scheduled workflow, so the real cron runs are unaffected.
  const forceSend = process.env.FORCE_SEND === 'true';

  if (!leagueId) {
    throw new Error('LEAGUE_ID environment variable is required.');
  }
  if (!groupInviteCode) {
    throw new Error('WHATSAPP_GROUP_INVITE_CODE environment variable is required.');
  }

  let gameweekStatus: GameweekStatus | null = null;

  if (forceSend) {
    console.log('FORCE_SEND is set — bypassing gameweek finalization and already-sent checks.');
  } else {
    gameweekStatus = await fetchCurrentGameweekStatus();
    if (!isFinalized(gameweekStatus)) {
      console.log('Current gameweek is not yet finalized. Skipping this run.');
      return;
    }

    const state = await readState(STATE_PATH);
    if (gameweekStatus.id === state.lastSentGameweek) {
      console.log(`Gameweek ${gameweekStatus.id} has already been sent. Skipping this run.`);
      return;
    }
  }

  const standings = await fetchStandings(leagueId);
  const leaderboardMessage = buildLeaderboardMessage(standings);

  const summary = await generateGameweekSummary(standings, gameweekStatus?.id ?? null);
  const message = summary ? `${summary}\n\n${leaderboardMessage}` : leaderboardMessage;

  const sock = await connect();
  try {
    const groupJid = await resolveGroupJid(sock, groupInviteCode);
    await sendGroupMessage(sock, groupJid, message);
  } finally {
    sock.end(undefined);
  }

  if (gameweekStatus) {
    await writeState(STATE_PATH, { lastSentGameweek: gameweekStatus.id });
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
