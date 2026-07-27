import makeWASocket, { DisconnectReason, useMultiFileAuthState, type WASocket } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import qrcode from 'qrcode-terminal';

const AUTH_STATE_FOLDER = 'auth_info_baileys';

export async function connect(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_STATE_FOLDER);

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  sock.ev.on('creds.update', saveCreds);

  await new Promise<void>((resolve, reject) => {
    sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('Scan this QR code with WhatsApp (Linked Devices):');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        resolve();
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          reject(new Error('WhatsApp session logged out. Delete the auth_info_baileys folder and re-scan the QR code.'));
        } else {
          reject(new Error(`WhatsApp connection closed before it opened (status ${statusCode ?? 'unknown'}).`));
        }
      }
    });
  });

  return sock;
}

export async function resolveGroupJid(sock: WASocket, groupInviteCode: string): Promise<string> {
  const info = await sock.groupGetInviteInfo(groupInviteCode);
  return info.id;
}

export async function sendGroupMessage(sock: WASocket, groupJid: string, message: string): Promise<void> {
  await sock.sendMessage(groupJid, { text: message });
}
