import type { MediaService } from './types';
import { LocalMediaService } from './local';
import { S3MediaService } from './s3';
import { CloudinaryMediaService } from './cloudinary';

export type { MediaService };
export { LocalMediaService } from './local';
export { S3MediaService, NotImplementedError } from './s3';
export { CloudinaryMediaService } from './cloudinary';

export function createMediaService(): MediaService {
  const backend = (process.env.MEDIA_BACKEND ?? 'local').toLowerCase().trim();
  switch (backend) {
    case 'local': return new LocalMediaService();
    case 's3': return new S3MediaService();
    case 'cloudinary': return new CloudinaryMediaService();
    default:
      console.warn(`Unknown MEDIA_BACKEND value "${backend}". Falling back to LocalMediaService.`);
      return new LocalMediaService();
  }
}

export const mediaService: MediaService = createMediaService();
