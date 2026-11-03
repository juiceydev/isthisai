import type { APIRoute } from 'astro';
import { findCheck, submit } from '../../lib/store';
import { notifyAdmins } from '../../lib/push';
import { isBanned } from '../../lib/bans';
import { clientIp } from '../../lib/ip';

const WINDOW = 60 * 60 * 1000;
const LIMIT = 20;
const hits = new Map<string, number[]>();

const allowed = (ip: string): boolean => {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW);
  if (recent.length >= LIMIT) return false;
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => now - t < WINDOW)) hits.delete(key);
    }
  }
  return true;
};

const back = (to: string) => new Response(null, { status: 303, headers: { Location: to } });

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const ip = clientIp(request, clientAddress);

  if (isBanned(ip)) return back('/?error=blocked');
  if (!allowed(ip)) return back('/?error=rate');

  const form = await request.formData().catch(() => null);
  if (!form) return back('/?error=bad');

  const sent = await submit(form.get('url'), ip);
  if (!sent) return back('/?error=bad');

  if (sent.pending) {
    const check = findCheck(sent.id);
    if (check) void notifyAdmins(check).catch(() => {});
  }

  return back(sent.pending ? `/?sent=1&id=${sent.id}&watch=1` : '/?sent=1');
};
