import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

export interface Meta {
  provider: string;
  title: string;
  author: string;
  description: string;
  thumbnail: string;
}

export const emptyMeta: Meta = {
  provider: '',
  title: '',
  author: '',
  description: '',
  thumbnail: '',
};

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36';
const BOT_UA = 'facebookexternalhit/1.1';

const host = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const path = (url: string): string => {
  try {
    return new URL(url).pathname;
  } catch {
    return '';
  }
};

export const youtubeId = (url: string): string | null => {
  try {
    const { hostname, pathname, searchParams } = new URL(url);
    const site = hostname.replace(/^www\./, '');
    if (site === 'youtu.be') {
      const id = pathname.slice(1, 12);
      return /^[\w-]{11}$/.test(id) ? id : null;
    }
    if (site !== 'youtube.com' && site !== 'm.youtube.com') return null;

    const fromPath = pathname.match(/^\/(?:shorts|embed|live)\/([\w-]{11})/)?.[1];
    const id = fromPath ?? (pathname === '/watch' ? searchParams.get('v') : null);
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch {
    return null;
  }
};

export const githubRepo = (url: string): { owner: string; repo: string } | null => {
  try {
    const { hostname, pathname } = new URL(url);
    if (hostname.replace(/^www\./, '') !== 'github.com') return null;
    const [owner, repoRaw] = pathname.split('/').filter(Boolean);
    if (!owner || !repoRaw) return null;
    const repo = repoRaw.replace(/\.git$/, '');
    if (!/^[\w.-]+$/.test(owner) || !/^[\w.-]+$/.test(repo)) return null;
    return { owner, repo };
  } catch {
    return null;
  }
};

export const tiktokId = (url: string): string | null => {
  if (host(url) !== 'tiktok.com') return null;
  return path(url).match(/\/(?:video|v)\/(\d{6,})/)?.[1] ?? null;
};

export const instagramId = (url: string): string | null => {
  const site = host(url);
  if (site !== 'instagram.com' && site !== 'instagr.am') return null;
  return path(url).match(/^\/(?:p|reel|reels|tv)\/([\w-]+)/)?.[1] ?? null;
};

export const xId = (url: string): string | null => {
  const site = host(url);
  if (!['x.com', 'twitter.com', 'mobile.twitter.com'].includes(site)) return null;
  return path(url).match(/\/status(?:es)?\/(\d+)/)?.[1] ?? null;
};

export const urlKey = (url: string): string => {
  const youtube = youtubeId(url);
  if (youtube) return `youtube:${youtube}`;
  const repo = githubRepo(url);
  if (repo) return `github:${repo.owner}/${repo.repo}`.toLowerCase();
  const tiktok = tiktokId(url);
  if (tiktok) return `tiktok:${tiktok}`;
  const instagram = instagramId(url);
  if (instagram) return `instagram:${instagram}`;
  const x = xId(url);
  if (x) return `x:${x}`;
  return `url:${url}`;
};

const decode = (value: string): string =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#(?:39|x27);/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&mdash;/g, '-')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tag = (html: string, key: string): string => {
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']*)`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${key}`, 'i'),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return decode(match[1]);
  }
  return '';
};

const og = (html: string, property: string): string => tag(html, `og:${property}`);

const absolute = (src: string, base: string): string => {
  if (!src) return '';
  try {
    const url = new URL(src, base);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
  } catch {
    return '';
  }
};

const bare = (hostname: string) => hostname.replace(/^\[|\]$/g, '').toLowerCase();

const privateAddress = (address: string): boolean => {
  let ip = address.toLowerCase();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip.includes(':')) {
    return ip === '::1' || ip === '::' || ip.startsWith('fe8') || ip.startsWith('fec') || /^f[cd]/.test(ip) || ip.startsWith('ff');
  }
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
};

const resolveSafe = async (hostname: string): Promise<string | null> => {
  const host = bare(hostname);
  if (!host || host === 'localhost' || host.endsWith('.local')) return null;
  try {
    const found = await lookup(host, { all: true });
    if (!found.length || found.some(({ address }) => privateAddress(address))) return null;
    return (found.find(({ family }) => family === 4) ?? found[0]).address;
  } catch {
    return null;
  }
};

const MAX_HTML = 500_000;
const TIMEOUT = 5000;

const get = (
  url: URL,
  userAgent: string,
  address: string,
  max = MAX_HTML,
  accept = 'text/html',
): Promise<{ status: number; location: string; body: Buffer }> =>
  new Promise((resolve) => {
    const host = bare(url.hostname);
    const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const family = address.includes(':') ? 6 : 4;
    const pinned = ((_name: string, options: { all?: boolean }, callback: (...args: unknown[]) => void) =>
      options?.all
        ? callback(null, [{ address, family }])
        : callback(null, address, family)) as never;
    const done = (body = Buffer.alloc(0), status = 0, location = '') =>
      resolve({ status, location, body });
    const req = send(
      {
        hostname: host,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        servername: host,
        headers: { 'user-agent': userAgent, accept },
        lookup: pinned,
        timeout: TIMEOUT,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        res.on('data', (chunk: Buffer) => {
          size += chunk.length;
          if (size > max) {
            res.destroy();
            done();
            return;
          }
          chunks.push(chunk);
        });
        res.on('end', () =>
          done(
            Buffer.concat(chunks),
            res.statusCode ?? 0,
            String(res.headers.location ?? ''),
          ),
        );
        res.on('error', () => done());
      },
    );
    req.on('timeout', () => {
      req.destroy();
      done();
    });
    req.on('error', () => done());
    req.end();
  });

const page = async (url: string, userAgent: string): Promise<string> => {
  let target = url;
  for (let hop = 0; hop < 3; hop++) {
    try {
      const parsed = new URL(target);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
      const address = await resolveSafe(parsed.hostname);
      if (!address) return '';
      const res = await get(parsed, userAgent, address);
      if (res.status >= 300 && res.status < 400) {
        if (!res.location) return '';
        target = new URL(res.location, target).href;
        continue;
      }
      return res.status >= 200 && res.status < 300 ? res.body.toString('utf8') : '';
    } catch {
      return '';
    }
  }
  return '';
};

const webPage = (url: string): Promise<string> => page(url, UA);

export const safeImage = async (src: string): Promise<Buffer | null> => {
  try {
    const url = new URL(src);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    const address = await resolveSafe(url.hostname);
    if (!address) return null;
    const res = await get(url, UA, address, 5_000_000, 'image/*');
    return res.status >= 200 && res.status < 300 && res.body.length ? res.body : null;
  } catch {
    return null;
  }
};

const metaForWeb = async (url: string): Promise<Meta> => {
  const meta: Meta = { ...emptyMeta, provider: 'web' };
  const html = await webPage(url);
  if (!html) return meta;

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  meta.title = (og(html, 'title') || tag(html, 'twitter:title') || decode(title)).slice(0, 200);
  meta.description = (
    og(html, 'description') ||
    tag(html, 'twitter:description') ||
    tag(html, 'description')
  ).slice(0, 200);
  meta.author = og(html, 'site_name').slice(0, 100);
  meta.thumbnail = absolute(og(html, 'image') || tag(html, 'twitter:image'), url);

  return meta;
};

const metaForTikTok = async (url: string): Promise<Meta> => {
  const meta: Meta = { ...emptyMeta, provider: 'tiktok' };
  let cover = '';

  try {
    const res = await fetch(url, {
      headers: { 'user-agent': UA, accept: 'text/html' },
      signal: AbortSignal.timeout(7000),
      redirect: 'follow',
    });
    const html = res.ok ? await res.text() : '';
    const raw = html.match(
      /<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/,
    )?.[1];

    if (raw) {
      const item = JSON.parse(raw).__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo
        ?.itemStruct;
      if (typeof item?.desc === 'string') meta.title = decode(item.desc).slice(0, 200);
      if (typeof item?.author?.nickname === 'string') {
        meta.author = decode(item.author.nickname).slice(0, 100);
      }
      if (typeof item?.video?.cover === 'string') cover = item.video.cover;
    }
  } catch {}

  const stub = await page(url, BOT_UA);
  if (stub) {
    if (!meta.title) {
      meta.title = og(stub, 'title').replace(/^TikTok\s*\u00b7\s*/, '').slice(0, 200);
    }
    meta.thumbnail = og(stub, 'image') || cover;
  }
  if (!meta.thumbnail) meta.thumbnail = cover;

  return meta;
};

const metaForX = async (url: string): Promise<Meta> => {
  const meta: Meta = { ...emptyMeta, provider: 'x' };

  try {
    const res = await fetch(
      `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}`,
      { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(5000) },
    );
    if (res.ok) {
      const data = (await res.json()) as { author_name?: unknown; html?: unknown };
      if (typeof data.author_name === 'string') meta.author = data.author_name.slice(0, 100);
      if (typeof data.html === 'string') {
        meta.title = decode(data.html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] ?? '').slice(
          0,
          200,
        );
      }
    }
  } catch {}

  const html = await page(url, 'Twitterbot/1.0');
  const image = og(html, 'image');
  if (!meta.title) meta.description = og(html, 'description').slice(0, 200);
  if (!meta.author) meta.author = og(html, 'title').replace(/ on X$/, '').slice(0, 100);
  if (image && !image.includes('/profile_images/')) meta.thumbnail = image;

  return meta;
};

export const metaFor = async (url: string): Promise<Meta> => {
  const repo = githubRepo(url);
  if (repo) {
    const meta: Meta = {
      provider: 'github',
      title: `${repo.owner}/${repo.repo}`,
      author: repo.owner,
      description: '',
      thumbnail: `https://opengraph.githubassets.com/1/${repo.owner}/${repo.repo}`,
    };

    try {
      const res = await fetch(`https://api.github.com/repos/${repo.owner}/${repo.repo}`, {
        signal: AbortSignal.timeout(4000),
        headers: {
          accept: 'application/vnd.github+json',
          'user-agent': 'isthisai',
        },
      });
      if (res.ok) {
        const data = (await res.json()) as {
          full_name?: unknown;
          description?: unknown;
          owner?: { login?: unknown };
        };
        if (typeof data.full_name === 'string') meta.title = data.full_name.slice(0, 200);
        if (typeof data.description === 'string') {
          meta.description = data.description.slice(0, 200);
        }
        if (typeof data.owner?.login === 'string') meta.author = data.owner.login;
      }
    } catch {}

    return meta;
  }

  const id = youtubeId(url);
  if (id) {
    const meta: Meta = {
      provider: 'youtube',
      title: '',
      author: '',
      description: '',
      thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
    };

    try {
      const watch = `https://www.youtube.com/watch?v=${id}`;
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(watch)}&format=json`,
        { signal: AbortSignal.timeout(4000), headers: { 'user-agent': UA } },
      );
      if (res.ok) {
        const data = (await res.json()) as { title?: unknown; author_name?: unknown };
        meta.title = typeof data.title === 'string' ? data.title.slice(0, 200) : '';
        meta.author = typeof data.author_name === 'string' ? data.author_name.slice(0, 100) : '';
      }
    } catch {}

    return meta;
  }

  if (tiktokId(url)) return metaForTikTok(url);
  if (xId(url)) return metaForX(url);
  if (instagramId(url)) return { ...emptyMeta, provider: 'instagram' };

  return metaForWeb(url);
};
