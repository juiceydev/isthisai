import type { APIRoute } from 'astro';
import { revision } from '../../lib/store';

export const GET: APIRoute = async () =>
  new Response(JSON.stringify({ rev: revision() }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
