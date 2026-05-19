import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/withAuth';
import { mediaService } from '@/lib/media';
import { validateMediaFile } from '@/lib/media/validation';

/**
 * POST /api/media/upload
 * Accepts multipart form data with a `file` field.
 * Validates MIME type and file size, then delegates to the MediaService.
 * Returns { url } on success. Does NOT create any database record.
 * Validates: Requirements 6.4, 6.5, 6.6, 9.1, 9.3, 9.4
 */
export const POST = withAuth('*', async (req: NextRequest) => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Failed to parse multipart form data' }, { status: 400 });
  }

  const fileEntry = formData.get('file');
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json({ error: 'Missing required field: file' }, { status: 400 });
  }

  const file = fileEntry as File;
  const mimeType = file.type;
  // Normalise codec-qualified audio MIME types for storage
  // e.g. "audio/webm;codecs=opus" → "audio/webm" so the file extension is correct
  const baseMimeType = mimeType.split(';')[0].trim();
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const validation = validateMediaFile(mimeType, buffer.length);

  if (!validation.valid) {
    const status = validation.reason === 'unsupported_mime_type' ? 415 : 413;
    return NextResponse.json({ error: validation.message }, { status });
  }

  try {
    const url = await mediaService.upload(buffer, file.name, baseMimeType);
    return NextResponse.json({ url }, { status: 200 });
  } catch (err) {
    console.error('[media/upload] Storage error:', err);
    return NextResponse.json({ error: 'Failed to store the file. Please try again.' }, { status: 500 });
  }
});
