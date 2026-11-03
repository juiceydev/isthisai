import type { APIRoute } from 'astro';
import { isAdmin } from '../../../lib/auth';
import { findCheck, remove, save } from '../../../lib/store';
import { notifyCheck } from '../../../lib/push';

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
    const before = findCheck(String(form.get('id') ?? ''));
    await save(form);
    if (before?.verdict === 'pending') {
      const after = findCheck(before.id);
      if (after && after.verdict !== 'pending') void notifyCheck(after).catch(() => {});
    }
  }

  return new Response(null, { status: 303, headers: { Location: '/admin' } });
};
