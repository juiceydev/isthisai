import type { APIRoute } from 'astro';
import { submit } from '../../lib/store';
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

  return back((await submit(form.get('url'), ip)) ? '/?sent=1' : '/?error=bad');
};
