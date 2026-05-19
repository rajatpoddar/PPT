import type { MediaService } from './types';

export class NotImplementedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotImplementedError';
  }
}

export class S3MediaService implements MediaService {
  async upload(_file: Buffer, _filename: string, _mimeType: string): Promise<string> {
    throw new NotImplementedError('S3MediaService is not yet implemented. Set MEDIA_BACKEND=local for development.');
  }
  async delete(_url: string): Promise<void> {
    throw new NotImplementedError('S3MediaService is not yet implemented. Set MEDIA_BACKEND=local for development.');
  }
}
