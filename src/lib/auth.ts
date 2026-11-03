import { createHmac, timingSafeEqual } from 'node:crypto';

export const cookieName = 'isthisai_admin';

export const adminKey = () =>
  process.env.ADMIN_KEY || import.meta.env.ADMIN_KEY || '';

const hmac = (value: string) =>
  createHmac('sha256', adminKey()).update(value).digest('hex');

export const createSession = () => {
  const expires = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7; // stackoverflow still useful for that one
  return `${expires}.${hmac(`isthisai:${expires}`)}`;
};

const validToken = (token: string): boolean => {
  if (!adminKey()) return false;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return false;
  const expires = token.slice(0, separator);
  if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
  const a = Buffer.from(token.slice(separator + 1), 'hex');
  const b = Buffer.from(hmac(`isthisai:${expires}`), 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
};

export const isAdmin = (request: Request): boolean => {
  if (!adminKey()) return false;
  const header = request.headers.get('cookie') ?? '';
  const match = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return !!match && validToken(match.slice(cookieName.length + 1));
};

export const keyMatches = (key: string): boolean => {
  const expected = adminKey();
  if (!expected || !key) return false;
  const a = Buffer.from(key, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
};
