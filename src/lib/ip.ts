const loopback = (ip: string) =>
  ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

export const clientIp = (request: Request, fallback: string): string => {
  if (!loopback(fallback)) return fallback || 'unknown';

  const cf = request.headers.get('cf-connecting-ip')?.trim();
  if (cf) return cf;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }

  return fallback || 'unknown';
};
