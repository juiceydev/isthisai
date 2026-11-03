import type { APIRoute } from 'astro';
import { cookieName } from '../../../lib/auth';

export const POST: APIRoute = async () =>
  new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
    },
  });
