import type { MediaService } from './types';
import { NotImplementedError } from './s3';

export class CloudinaryMediaService implements MediaService {
  async upload(_file: Buffer, _filename: string, _mimeType: string): Promise<string> {
    throw new NotImplementedError('CloudinaryMediaService is not yet implemented. Set MEDIA_BACKEND=local for development.');
  }
  async delete(_url: string): Promise<void> {
    throw new NotImplementedError('CloudinaryMediaService is not yet implemented. Set MEDIA_BACKEND=local for development.');
  }
}
