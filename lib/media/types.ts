/**
 * MediaService interface — abstracts the storage backend for audio and image files.
 */
export interface MediaService {
  upload(file: Buffer, filename: string, mimeType: string): Promise<string>;
  delete(url: string): Promise<void>;
}
