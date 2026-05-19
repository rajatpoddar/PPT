/**
 * Shared media file validation logic.
 *
 * Centralises the MIME-type allow-list and per-type size limits so that both
 * the upload API route and the property-based tests can import from a single
 * source of truth.
 *
 * Validates: Requirements 6.4, 6.5, 6.6
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
export const AUDIO_MAX_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Maps every accepted MIME type to its maximum allowed file size in bytes.
 * Any MIME type absent from this map is rejected outright.
 */
export const ALLOWED_MIME_TYPES: Record<string, number> = {
  'image/jpeg': IMAGE_MAX_BYTES,
  'image/png': IMAGE_MAX_BYTES,
  'image/webp': IMAGE_MAX_BYTES,
  'audio/webm': AUDIO_MAX_BYTES,
  'audio/webm;codecs=opus': AUDIO_MAX_BYTES,
  'audio/webm;codecs=pcm': AUDIO_MAX_BYTES,
  'audio/mp4': AUDIO_MAX_BYTES,
  'audio/ogg': AUDIO_MAX_BYTES,
  'audio/ogg;codecs=opus': AUDIO_MAX_BYTES,
};

export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const ACCEPTED_AUDIO_TYPES = ['audio/webm', 'audio/mp4', 'audio/ogg'] as const;
export const ACCEPTED_MIME_TYPES = [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_AUDIO_TYPES] as const;

// ---------------------------------------------------------------------------
// Validation result type
// ---------------------------------------------------------------------------

export type ValidationResult =
  | { valid: true }
  | { valid: false; reason: 'unsupported_mime_type' | 'file_too_large'; message: string };

// ---------------------------------------------------------------------------
// Core validation function
// ---------------------------------------------------------------------------

/**
 * Validates a file's MIME type and byte-length against the allow-list.
 *
 * Rules:
 *  - If `mimeType` is not in ALLOWED_MIME_TYPES → rejected (unsupported_mime_type)
 *  - If `sizeBytes` exceeds the limit for `mimeType` → rejected (file_too_large)
 *  - Otherwise → accepted
 *
 * @param mimeType  The MIME type reported by the client (e.g. "image/jpeg").
 * @param sizeBytes The file size in bytes.
 * @returns         A ValidationResult indicating acceptance or the rejection reason.
 */
export function validateMediaFile(mimeType: string, sizeBytes: number): ValidationResult {
  const maxBytes = ALLOWED_MIME_TYPES[mimeType];

  if (maxBytes === undefined) {
    return {
      valid: false,
      reason: 'unsupported_mime_type',
      message: `Unsupported media type: ${mimeType}. Accepted: ${Object.keys(ALLOWED_MIME_TYPES).join(', ')}`,
    };
  }

  if (sizeBytes > maxBytes) {
    const maxMB = maxBytes / (1024 * 1024);
    return {
      valid: false,
      reason: 'file_too_large',
      message: `File too large. Maximum allowed size for ${mimeType} is ${maxMB} MB`,
    };
  }

  return { valid: true };
}
