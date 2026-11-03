import { constants, brotliCompressSync, gzipSync } from 'node:zlib';
import { defineMiddleware } from 'astro:middleware';

const ok = /^(text\/|application\/(json|javascript|xml))/;

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  response.headers.set('x-frame-options', 'DENY');
  response.headers.set('x-content-type-options', 'nosniff');
  response.headers.set('referrer-policy', 'same-origin');

  const type = response.headers.get('content-type') ?? '';
  if (type.includes('text/html')) {
    response.headers.set('cache-control', 'no-store');
  }

  if (
    context.request.method === 'HEAD' ||
    response.status !== 200 ||
    !response.body ||
    response.headers.has('content-encoding') ||
    !ok.test(type)
  ) {
    return response;
  }

  const raw = Buffer.from(await response.arrayBuffer());
  if (raw.length < 1024) return new Response(raw, response);

  const accept = context.request.headers.get('accept-encoding') ?? '';
  const brotli = accept.includes('br');
  if (!brotli && !accept.includes('gzip')) return new Response(raw, response);

  const body = brotli
    ? brotliCompressSync(raw, { params: { [constants.BROTLI_PARAM_QUALITY]: 5 } })
    : gzipSync(raw, { level: 6 });

  const headers = new Headers(response.headers);
  headers.set('content-encoding', brotli ? 'br' : 'gzip');
  headers.set('content-length', String(body.length));
  headers.append('vary', 'accept-encoding');
  return new Response(body, { status: 200, statusText: response.statusText, headers });
});
