const port = process.env.PORT ?? '4330';
const host = process.env.HOST ?? '127.0.0.1';
process.env.PORT = String(port);
process.env.HOST = String(host);
await import(new URL('../dist/server/entry.mjs', import.meta.url));
