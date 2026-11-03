import type { APIRoute } from 'astro';
import { isAdmin } from '../../lib/auth';
import { findCheck } from '../../lib/store';
import { subscribe } from '../../lib/push';
import { clientIp } from '../../lib/ip';

const hits = new Map<string, number[]>();
const WINDOW = 60 * 60 * 1000;
const LIMIT = 30;

const allowed = (ip: string): boolean => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  return true;
};

const text = (value: unknown, max: number): string =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : '';

const base64 = (value: unknown): string => {
  const raw = text(value, 200);
  return /^[A-Za-z0-9_-]+={0,2}$/.test(raw) && raw.length >= 16 ? raw : '';
};

const endpoint = (value: unknown): string => {
  const raw = text(value, 1000);
  if (!raw) return '';
  try {
    return new URL(raw).protocol === 'https:' ? raw : '';
  } catch {
    return '';
  }
};

export const POST: APIRoute = async ({ request, clientAddress }) => {
  if (Number(request.headers.get('content-length') ?? 0) > 4096) {
    return new Response(null, { status: 413 });
  }

  const ip = clientIp(request, clientAddress);
  if (!allowed(ip)) return new Response(null, { status: 429 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return new Response(null, { status: 400 });

  const url = endpoint(body.endpoint);
  const keys = body.keys as Record<string, unknown> | undefined;
  const p256dh = base64(keys?.p256dh);
  const auth = base64(keys?.auth);
  if (!url || !p256dh || !auth) return new Response(null, { status: 400 });

  const checkId = text(body.id, 64);
  const check = checkId ? findCheck(checkId) : undefined;
  const target = check && check.verdict === 'pending' ? check.id : '';
  const admin = body.admin === true && isAdmin(request);

  return subscribe(url, { p256dh, auth }, target, admin)
    ? new Response(JSON.stringify({ ok: true }), {
        headers: { 'content-type': 'application/json' },
      })
    : new Response(null, { status: 503 });
};
