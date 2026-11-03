import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { emptyMeta, metaFor, urlKey } from './meta';
import type { Meta } from './meta';

export type Verdict =
  | 'pending'
  | 'vibecoded'
  | 'diffusion'
  | 'claude'
  | 'unsure'
  | 'possibly'
  | 'notai';
export type Method = 'human' | 'pangram' | 'other';

export interface Check extends Meta {
  id: string;
  url: string;
  ip?: string;
  verdict: Verdict;
  method: Method;
  note: string;
  pangram: string;
  submittedAt: string;
  checkedAt: string | null;
}

export const VERDICTS: Verdict[] = [
  'pending',
  'vibecoded',
  'diffusion',
  'claude',
  'unsure',
  'possibly',
  'notai',
];
export const METHODS: Method[] = ['human', 'pangram', 'other'];

const LEGACY: Record<string, Verdict> = { ai: 'vibecoded', real: 'notai' };

const FILE = join(resolve(process.env.DATA_DIR ?? 'data'), 'checks.json');
const NOTE_MAX = 300;
const URL_MAX = 2048;

export const cleanUrl = (raw: unknown): string | null => {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value || value.length > URL_MAX) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url.href;
  } catch {
    return null;
  }
};

const optionalUrl = (raw: unknown): string => {
  if (typeof raw !== 'string' || !raw.trim()) return '';
  return cleanUrl(raw) ?? '';
};

const text = (raw: unknown, max: number): string =>
  typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const read = (): Check[] => {
  try {
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as { checks?: Partial<Check>[] };
    if (!Array.isArray(parsed.checks)) return [];
    return parsed.checks.map((c) => {
      const verdict = LEGACY[String(c.verdict)] ?? c.verdict;
      return { ...emptyMeta, ...c, verdict: verdict as Verdict } as Check;
    });
  } catch {
    return [];
  }
};

const write = (checks: Check[]) => {
  mkdirSync(dirname(FILE), { recursive: true });
  const tmp = `${FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify({ version: 1, checks }, null, 2), 'utf8');
  renameSync(tmp, FILE);
};

const newestFirst = (a: Check, b: Check) =>
  Date.parse(b.checkedAt ?? b.submittedAt) - Date.parse(a.checkedAt ?? a.submittedAt);

export const listPending = (): Check[] =>
  read()
    .filter((c) => c.verdict === 'pending')
    .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

export const listChecked = (limit = 40): Check[] =>
  read()
    .filter((c) => c.verdict !== 'pending' && c.checkedAt)
    .sort(newestFirst)
    .slice(0, limit);

export const listRecent = (limit = 40, after?: string | null): Check[] => {
  const all = read().sort(newestFirst);
  const start = after ? Math.max(0, all.findIndex((check) => check.id === after) + 1) : 0;
  return all.slice(start, start + limit);
};

export const revision = (): number => {
  try {
    return statSync(FILE).mtimeMs;
  } catch {
    return 0;
  }
};

export const findCheck = (id: string): Check | undefined =>
  read().find((check) => check.id === id);

export const submit = async (rawUrl: unknown, ip = ''): Promise<boolean> => {
  const url = cleanUrl(rawUrl);
  if (!url) return false;
  const checks = read();
  const key = urlKey(url);
  const same = checks.filter((check) => urlKey(check.url) === key);

  if (same.some((check) => check.verdict === 'pending')) return true;

  const signed = same
    .filter((check) => check.checkedAt && check.verdict !== 'pending')
    .sort((a, b) => Date.parse(b.checkedAt ?? '') - Date.parse(a.checkedAt ?? ''))[0];

  if (signed) {
    const now = new Date().toISOString();
    checks.push({ ...signed, id: randomBytes(6).toString('hex'), url, submittedAt: now, checkedAt: now });
    write(checks);
    return true;
  }

  checks.push({
    id: randomBytes(6).toString('hex'),
    url,
    ...(ip ? { ip } : {}),
    ...(await metaFor(url)),
    verdict: 'pending',
    method: 'human',
    note: '',
    pangram: '',
    submittedAt: new Date().toISOString(),
    checkedAt: null,
  });
  write(checks);
  return true;
};

export const save = async (form: FormData): Promise<boolean> => {
  const url = cleanUrl(form.get('url'));
  if (!url) return false;

  const verdictRaw = String(form.get('verdict') ?? 'pending');
  const verdict = (VERDICTS as string[]).includes(verdictRaw)
    ? (verdictRaw as Verdict)
    : 'pending';
  const methodRaw = String(form.get('method') ?? 'human');
  const method = (METHODS as string[]).includes(methodRaw) ? (methodRaw as Method) : 'human';

  const checks = read();
  const id = String(form.get('id') ?? '');
  const existing = checks.find((c) => c.id === id);
  const checkedAt =
    verdict === 'pending' ? null : (existing?.checkedAt ?? new Date().toISOString());
  const meta = existing?.url === url ? null : await metaFor(url);

  if (existing) {
    Object.assign(existing, {
      url,
      verdict,
      method,
      note: text(form.get('note'), NOTE_MAX),
      pangram: optionalUrl(form.get('pangram')),
      checkedAt,
      ...(meta ?? {}),
    });
  } else {
    checks.push({
      id: randomBytes(6).toString('hex'),
      url,
      ...(meta ?? emptyMeta),
      verdict,
      method,
      note: text(form.get('note'), NOTE_MAX),
      pangram: optionalUrl(form.get('pangram')),
      submittedAt: new Date().toISOString(),
      checkedAt,
    });
  }

  write(checks);
  return true;
};

export const remove = (id: string): boolean => {
  const checks = read();
  const next = checks.filter((c) => c.id !== id);
  if (next.length === checks.length) return false;
  write(next);
  return true;
};
