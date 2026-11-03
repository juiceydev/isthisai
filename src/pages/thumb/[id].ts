import type { APIRoute } from 'astro';
import { findCheck } from '../../lib/store';
import { thumbFor } from '../../lib/thumbs';

export const GET: APIRoute = async ({ params }) => {
  const check = findCheck(String(params.id ?? ''));
  if (!check?.thumbnail) return new Response(null, { status: 404 });

  const body = await thumbFor(check.id, check.thumbnail);
  if (!body) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(body), {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
};
