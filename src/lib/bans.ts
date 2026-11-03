import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const FILE = join(resolve(process.env.DATA_DIR ?? 'data'), 'bans.json');

export interface Ban {
  ip: string;
  at: string;
}

const read = (): Ban[] => {
  try {
    const data = JSON.parse(readFileSync(FILE, 'utf8')) as { bans?: Ban[] };
    return Array.isArray(data.bans) ? data.bans : [];
  } catch {
    return [];
  }
};

const write = (bans: Ban[]): void => {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(`${FILE}.tmp`, JSON.stringify({ bans }, null, 2));
  renameSync(`${FILE}.tmp`, FILE);
};

export const listBans = (): Ban[] =>
  read().sort((a, b) => Date.parse(b.at) - Date.parse(a.at));

export const isBanned = (ip: string): boolean => read().some((ban) => ban.ip === ip);

export const ban = (ip: string): void => {
  const bans = read();
  if (bans.some((entry) => entry.ip === ip)) return;
  bans.push({ ip, at: new Date().toISOString() });
  write(bans);
};

export const unban = (ip: string): void => {
  write(read().filter((entry) => entry.ip !== ip));
};
