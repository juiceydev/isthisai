import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { remove, save } from '../../../lib/store';

export const POST: APIRoute = async ({ request }) => {
  if (!isAdmin(request)) {
    return new Response('Not authorized', { status: 401 });
  }

  const form = await request.formData().catch(() => null);
  if (!form) {
    return new Response(null, { status: 303, headers: { Location: '/admin' } });
  }

  if (form.get('action') === 'delete') {
    remove(String(form.get('id') ?? ''));
  } else {
    await save(form);
  }

  return new Response(null, { status: 303, headers: { Location: '/admin' } });
};
