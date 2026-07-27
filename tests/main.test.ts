import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/whatsapp.js', () => ({
  connect: vi.fn(),
  resolveGroupJid: vi.fn(),
  sendGroupMessage: vi.fn(),
}));

vi.mock('../src/gameweekStatus.js', () => ({
  fetchCurrentGameweekStatus: vi.fn(),
  isFinalized: vi.fn(),
}));

vi.mock('../src/state.js', () => ({
  readState: vi.fn(),
  writeState: vi.fn(),
}));

import { connect, resolveGroupJid, sendGroupMessage } from '../src/whatsapp.js';
import { fetchCurrentGameweekStatus, isFinalized } from '../src/gameweekStatus.js';
import { readState, writeState } from '../src/state.js';
import { main } from '../src/main.js';

describe('main', () => {
  const mockSock = { end: vi.fn() } as unknown as Awaited<ReturnType<typeof connect>>;
  const finalizedStatus = { id: 5, finished: true, dataChecked: true };

  beforeEach(() => {
    vi.resetAllMocks();
    process.env.LEAGUE_ID = '12345';
    process.env.WHATSAPP_GROUP_INVITE_CODE = 'invite-code';
    delete process.env.FORCE_SEND;

    vi.mocked(connect).mockResolvedValue(mockSock);
    vi.mocked(resolveGroupJid).mockResolvedValue('12345-6789@g.us');
    vi.mocked(sendGroupMessage).mockResolvedValue(undefined);

    vi.mocked(fetchCurrentGameweekStatus).mockResolvedValue(finalizedStatus);
    vi.mocked(isFinalized).mockReturnValue(true);
    vi.mocked(readState).mockResolvedValue({ lastSentGameweek: null });
    vi.mocked(writeState).mockResolvedValue(undefined);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () =>
          Promise.resolve({
            standings: {
              results: [{ entry_name: 'Team 1', rank: 1, last_rank: 1, total: 100 }],
            },
          }),
      }),
    );
  });

  it('sends the formatted leaderboard to the resolved group JID, closes the socket, and records the sent gameweek', async () => {
    await main();

    expect(resolveGroupJid).toHaveBeenCalledWith(mockSock, 'invite-code');
    expect(sendGroupMessage).toHaveBeenCalledWith(mockSock, '12345-6789@g.us', '1. Team 1 ◀ 0');
    expect(mockSock.end).toHaveBeenCalled();
    expect(writeState).toHaveBeenCalledWith('send-state.json', { lastSentGameweek: 5 });
  });

  it('does not connect to WhatsApp when the gameweek is not finalized', async () => {
    vi.mocked(isFinalized).mockReturnValue(false);

    await main();

    expect(connect).not.toHaveBeenCalled();
    expect(sendGroupMessage).not.toHaveBeenCalled();
    expect(writeState).not.toHaveBeenCalled();
  });

  it('does not connect to WhatsApp when the finalized gameweek was already sent', async () => {
    vi.mocked(readState).mockResolvedValue({ lastSentGameweek: 5 });

    await main();

    expect(connect).not.toHaveBeenCalled();
    expect(sendGroupMessage).not.toHaveBeenCalled();
    expect(writeState).not.toHaveBeenCalled();
  });

  it('bypasses the finalization and already-sent checks when FORCE_SEND is set', async () => {
    process.env.FORCE_SEND = 'true';
    vi.mocked(isFinalized).mockReturnValue(false);

    await main();

    expect(fetchCurrentGameweekStatus).not.toHaveBeenCalled();
    expect(readState).not.toHaveBeenCalled();
    expect(sendGroupMessage).toHaveBeenCalledWith(mockSock, '12345-6789@g.us', '1. Team 1 ◀ 0');
    expect(mockSock.end).toHaveBeenCalled();
    expect(writeState).not.toHaveBeenCalled();
  });

  it('throws when LEAGUE_ID is missing', async () => {
    delete process.env.LEAGUE_ID;

    await expect(main()).rejects.toThrow('LEAGUE_ID');
  });

  it('throws when WHATSAPP_GROUP_INVITE_CODE is missing', async () => {
    delete process.env.WHATSAPP_GROUP_INVITE_CODE;

    await expect(main()).rejects.toThrow('WHATSAPP_GROUP_INVITE_CODE');
  });
});
