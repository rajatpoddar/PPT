import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import type { MediaService } from './types';

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9.\-]/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function getExtension(filename: string): string {
  const ext = path.extname(filename);
  return ext ? ext.toLowerCase() : '';
}

export class LocalMediaService implements MediaService {
  constructor(
    private readonly uploadsRoot: string = path.join(process.cwd(), 'public', 'uploads'),
  ) {}

  async upload(file: Buffer, filename: string, _mimeType: string): Promise<string> {
    const now = new Date();
    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const destDir = path.join(this.uploadsRoot, year, month);
    await fs.mkdir(destDir, { recursive: true });
    const id = crypto.randomUUID();
    const ext = getExtension(filename);
    const nameWithoutExt = filename.slice(0, filename.length - ext.length);
    const slug = slugify(nameWithoutExt);
    const storedFilename = `${id}-${slug}${ext}`;
    const destPath = path.join(destDir, storedFilename);
    await fs.writeFile(destPath, file);
    return `/uploads/${year}/${month}/${storedFilename}`;
  }

  async delete(url: string): Promise<void> {
    const relativePath = url.replace(/^\/uploads\//, '');
    const filePath = path.join(this.uploadsRoot, relativePath);
    await fs.unlink(filePath);
  }
}
