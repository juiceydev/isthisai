import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import sharp from 'sharp';
import { safeImage } from './meta';

const DIR = join(resolve(process.env.DATA_DIR ?? 'data'), 'thumbs');
const file = (id: string) => join(DIR, `${id}.webp`);

export const thumbFor = async (id: string, src: string): Promise<Buffer | null> => {
  try {
    return readFileSync(file(id));
  } catch {}

  const raw = await safeImage(src);
  if (!raw) return null;

  try {
    const out = await sharp(raw).resize(320, 180, { fit: 'cover' }).webp({ quality: 70 }).toBuffer();
    mkdirSync(dirname(file(id)), { recursive: true });
    writeFileSync(file(id), out);
    return out;
  } catch {
    return null;
  }
};
