import type { APIRoute } from 'astro';
import { cookieName, createSession, keyMatches } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  const form = await request.formData().catch(() => null);
  const key = String(form?.get('key') ?? '');

  if (!keyMatches(key)) {
    return new Response(null, { status: 303, headers: { Location: '/admin?error=1' } });
  }

  const secure =
    request.headers.get('x-forwarded-proto') === 'https' ||
    new URL(request.url).protocol === 'https:';

  return new Response(null, {
    status: 303,
    headers: {
      Location: '/admin',
      'Set-Cookie': `${cookieName}=${createSession()}; Path=/; HttpOnly; ${secure ? 'Secure; ' : ''}SameSite=Lax; Max-Age=604800`,
    },
  });
};
