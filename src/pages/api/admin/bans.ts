import type { APIRoute } from 'astro';
import { isIP } from 'node:net';
import { isAdmin } from '../../../lib/auth';
import { ban, unban } from '../../../lib/bans';

const back = () => new Response(null, { status: 303, headers: { Location: '/admin' } });

export const POST: APIRoute = async ({ request }) => {
  if (!isAdmin(request)) {
    return new Response('Not authorized', { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) return back();

  const ip = String(form.get('ip') ?? '').trim();
  if (!isIP(ip)) return back();

  if (form.get('action') === 'unban') {
    unban(ip);
  } else {
    ban(ip);
  }

  return back();
};
