"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, ImagePlus, X, AlertCircle, Loader2, UploadCloud, MapPin } from "lucide-react";

const ACCEPTED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

interface Photo {
  id: string;
  url: string;
  uploadedAt: string;
  latitude?: number | null;
  longitude?: number | null;
}

export interface PhotoUploaderProps {
  planId: string;
  initialPhotos?: Photo[];
}

function ErrorBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss error" className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function formatUploadTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function validateFile(file: File): string | null {
  if (!(ACCEPTED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return `Unsupported file type: ${file.type || "unknown"}. Please upload a JPEG, PNG, or WebP image.`;
  }
  if (file.size > IMAGE_MAX_BYTES) {
    return `File too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 10 MB.`;
  }
  return null;
}

/** Get current GPS coordinates, resolves to null if unavailable */
function getGeolocation(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 30000 }
    );
  });
}

/**
 * PhotoUploader — camera-first photo upload with geolocation tagging.
 * On mobile, opens the rear camera directly. Falls back to file picker.
 * Requirements: 6.1, 6.2, 6.4, 6.5, 6.6, 6.7, 9.3, 10.1, 10.3
 */
export default function PhotoUploader({ planId, initialPhotos = [] }: PhotoUploaderProps) {
  const [photos, setPhotos] = useState<Photo[]>(
    [...initialPhotos].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
  );
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [geoStatus, setGeoStatus] = useState<string | null>(null);

  // Two separate file inputs: one for camera, one for gallery/drag
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const uploadFile = useCallback(async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) { setError(validationError); return; }
    setError(null);
    setIsUploading(true);
    setGeoStatus("Getting location…");

    // Get geolocation in parallel with upload prep
    const geo = await getGeolocation();
    setGeoStatus(geo ? `📍 ${geo.latitude.toFixed(5)}, ${geo.longitude.toFixed(5)}` : null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/media/upload", { method: "POST", body: formData });
      if (!uploadRes.ok) {
        const body = await uploadRes.json().catch(() => ({}));
        setError(body?.error ?? `Upload failed with status ${uploadRes.status}.`);
        return;
      }
      const { url } = (await uploadRes.json()) as { url: string };

      // Save photo record with optional geolocation
      const photoPayload: Record<string, unknown> = { planId, url };
      if (geo) {
        photoPayload.latitude = geo.latitude;
        photoPayload.longitude = geo.longitude;
      }

      const photoRes = await fetch("/api/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(photoPayload),
      });
      if (!photoRes.ok) {
        const body = await photoRes.json().catch(() => ({}));
        setError(body?.error ?? `Failed to save photo record (status ${photoRes.status}).`);
        return;
      }
      const newPhoto = (await photoRes.json()) as Photo;
      setPhotos((prev) => [newPhoto, ...prev]);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }, [planId]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }, []);
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.stopPropagation(); setIsDragOver(false);
    if (isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  }, [isUploading, uploadFile]);

  const handleGalleryClick = useCallback(() => { if (isUploading) return; galleryInputRef.current?.click(); }, [isUploading]);
  const handleCameraClick = useCallback(() => { if (isUploading) return; cameraInputRef.current?.click(); }, [isUploading]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = "";
  }, [uploadFile]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleGalleryClick(); }
  }, [handleGalleryClick]);

  return (
    <section aria-label="Photo upload" className="flex flex-col gap-4">
      <h2 className="text-base font-semibold text-gray-900">Site Photos</h2>
      {error && <ErrorBanner message={error} onDismiss={() => setError(null)} />}

      {/* Camera button — opens rear camera on mobile */}
      <button
        type="button"
        onClick={handleCameraClick}
        disabled={isUploading}
        aria-label="Take a photo with camera"
        className={[
          "flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl",
          "bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm",
          "transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isUploading ? "cursor-not-allowed opacity-60" : "hover:bg-blue-700 active:bg-blue-800",
        ].join(" ")}
      >
        {isUploading ? (
          <><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /><span>Uploading…</span></>
        ) : (
          <><Camera className="h-5 w-5" aria-hidden="true" /><span>Take Photo</span></>
        )}
      </button>

      {/* Geolocation status */}
      {geoStatus && (
        <p className="flex items-center gap-1.5 text-xs text-gray-500">
          <MapPin className="h-3.5 w-3.5 text-green-500" aria-hidden="true" />
          {geoStatus}
        </p>
      )}

      {/* Drag-and-drop / gallery fallback */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload from gallery — tap or drag and drop an image here"
        aria-disabled={isUploading}
        onClick={handleGalleryClick}
        onKeyDown={handleKeyDown}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          "flex min-h-[80px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-4 transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
          isUploading ? "cursor-not-allowed border-blue-300 bg-blue-50" : isDragOver ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50",
        ].join(" ")}
      >
        {isDragOver
          ? <><UploadCloud className="h-6 w-6 text-blue-500" aria-hidden="true" /><p className="text-sm font-medium text-gray-700">Drop to upload</p></>
          : <><ImagePlus className="h-6 w-6 text-gray-400" aria-hidden="true" /><p className="text-sm text-gray-500">Or choose from gallery</p></>
        }
      </div>

      {/* Hidden file inputs */}
      {/* Camera input — capture="environment" opens rear camera on mobile */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={handleFileChange}
        disabled={isUploading}
      />
      {/* Gallery input — no capture attribute, opens file picker */}
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only"
        onChange={handleFileChange}
        disabled={isUploading}
      />

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium text-gray-700">Uploaded Photos ({photos.length})</h3>
          <ul aria-label="Uploaded photos" className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {photos.map((photo) => (
              <li key={photo.id} className="flex flex-col gap-1">
                <div className="relative aspect-square overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt={`Site photo uploaded at ${formatUploadTime(photo.uploadedAt)}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  {/* Geo badge */}
                  {photo.latitude && photo.longitude && (
                    <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5">
                      <MapPin className="h-2.5 w-2.5 text-green-400" aria-hidden="true" />
                      <span className="text-[9px] text-white leading-none">GPS</span>
                    </div>
                  )}
                </div>
                <time dateTime={photo.uploadedAt} className="text-center text-xs text-gray-400">
                  {formatUploadTime(photo.uploadedAt)}
                </time>
                {photo.latitude && photo.longitude && (
                  <a
                    href={`https://maps.google.com/?q=${photo.latitude},${photo.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-center text-[10px] text-blue-500 hover:underline"
                  >
                    View on map
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {photos.length === 0 && !isUploading && (
        <p className="text-center text-sm text-gray-400 italic">No photos uploaded yet.</p>
      )}
    </section>
  );
}
