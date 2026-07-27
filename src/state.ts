import { readFile, writeFile } from 'node:fs/promises';

export interface SendState {
  lastSentGameweek: number | null;
}

const DEFAULT_STATE: SendState = { lastSentGameweek: null };

export async function readState(path: string): Promise<SendState> {
  try {
    const contents = await readFile(path, 'utf-8');
    return JSON.parse(contents) as SendState;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return DEFAULT_STATE;
    }
    throw error;
  }
}

export function serializeState(state: SendState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

export async function writeState(path: string, state: SendState): Promise<void> {
  await writeFile(path, serializeState(state), 'utf-8');
}
