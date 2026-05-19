"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Mic, MicOff, Square, Play, Pause, X, AlertCircle } from "lucide-react";

// ---------------------------------------------------------------------------
// Inline placeholder components — will be replaced by shared components in
// task 10.1 (AudioPlayer) and task 10.1 (ErrorBanner).
// ---------------------------------------------------------------------------

interface InlineErrorBannerProps {
  message: string;
  onDismiss?: () => void;
}

function InlineErrorBanner({ message, onDismiss }: InlineErrorBannerProps) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss warning"
          className="ml-auto shrink-0 rounded p-0.5 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

interface InlineAudioPlayerProps {
  src: string;
  onRemove?: () => void;
}

function InlineAudioPlayer({ src, onRemove }: InlineAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
      {/* Hidden native audio element */}
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration ?? 0)}
        aria-label="Voice recording preview"
      />

      {/* Play / Pause button */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause recording" : "Play recording"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 active:bg-blue-800"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Play className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex flex-1 flex-col gap-1">
        <input
          type="range"
          min={0}
          max={duration || 1}
          value={currentTime}
          onChange={(e) => {
            const t = Number(e.target.value);
            if (audioRef.current) audioRef.current.currentTime = t;
            setCurrentTime(t);
          }}
          aria-label="Seek recording"
          className="h-1.5 w-full cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Remove button */}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove recording"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-400"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// VoiceRecorder
// ---------------------------------------------------------------------------

export interface VoiceRecorderProps {
  /** Called when a recording is finalised and ready for upload. */
  onRecordingComplete: (blob: Blob) => void;
  /** Optional label shown above the recorder. */
  label?: string;
  /** Disable the entire recorder (e.g. while the parent form is submitting). */
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "preview";

/**
 * VoiceRecorder — shared component for capturing voice notes / remarks.
 *
 * Supports two interaction modes:
 *  - Hold-to-record: mousedown / touchstart → mouseup / touchend
 *  - Tap-to-record: click to start, click again to stop
 *
 * Checks MediaRecorder API availability on mount. If unavailable, renders a
 * warning banner and hides the record button so the parent form remains
 * submittable without a voice note (Requirements 3.8, 10.4).
 *
 * Requirements: 3.4, 3.5, 3.8, 7.3, 10.4, 10.5
 */
export default function VoiceRecorder({
  onRecordingComplete,
  label = "Voice Note",
  disabled = false,
}: VoiceRecorderProps) {
  // -------------------------------------------------------------------------
  // API availability check
  // -------------------------------------------------------------------------
  const [isApiAvailable, setIsApiAvailable] = useState<boolean | null>(null); // null = not yet checked
  const [apiWarningDismissed, setApiWarningDismissed] = useState(false);

  useEffect(() => {
    const available =
      typeof window !== "undefined" &&
      typeof window.MediaRecorder !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia;
    setIsApiAvailable(available);
  }, []);

  // -------------------------------------------------------------------------
  // Recording state
  // -------------------------------------------------------------------------
  const [recorderState, setRecorderState] = useState<RecorderState>("idle");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track whether the current recording was started via hold (pointer down)
  // so we know to stop it on pointer up.
  const isHoldModeRef = useRef(false);

  // -------------------------------------------------------------------------
  // Cleanup on unmount
  // -------------------------------------------------------------------------
  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // Timer helpers
  // -------------------------------------------------------------------------
  const startTimer = () => {
    setElapsedSeconds(0);
    timerRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // -------------------------------------------------------------------------
  // Start recording
  // -------------------------------------------------------------------------
  const startRecording = useCallback(async () => {
    if (recorderState === "recording" || disabled) return;

    setRecordingError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer webm/opus; fall back to whatever the browser supports.
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setRecorderState("preview");
        onRecordingComplete(blob);

        // Release the microphone
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      recorder.start();
      setRecorderState("recording");
      startTimer();
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not access microphone. Please check your browser permissions.";
      setRecordingError(message);
      setRecorderState("idle");
    }
  }, [recorderState, disabled, onRecordingComplete]);

  // -------------------------------------------------------------------------
  // Stop recording
  // -------------------------------------------------------------------------
  const stopRecording = useCallback(() => {
    if (recorderState !== "recording") return;
    stopTimer();
    mediaRecorderRef.current?.stop();
    // State transitions to "preview" inside recorder.onstop
  }, [recorderState]);

  // -------------------------------------------------------------------------
  // Tap-to-record toggle (click handler)
  // -------------------------------------------------------------------------
  const handleClick = useCallback(() => {
    if (disabled) return;
    if (recorderState === "idle") {
      isHoldModeRef.current = false;
      startRecording();
    } else if (recorderState === "recording" && !isHoldModeRef.current) {
      // Only stop on click if we started via click (not hold)
      stopRecording();
    }
  }, [disabled, recorderState, startRecording, stopRecording]);

  // -------------------------------------------------------------------------
  // Hold-to-record handlers
  // -------------------------------------------------------------------------
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLButtonElement>) => {
      if (disabled || recorderState !== "idle") return;
      // Prevent the subsequent click event from firing a tap-toggle
      e.preventDefault();
      isHoldModeRef.current = true;
      startRecording();
    },
    [disabled, recorderState, startRecording]
  );

  const handlePointerUp = useCallback(() => {
    if (recorderState === "recording" && isHoldModeRef.current) {
      stopRecording();
      isHoldModeRef.current = false;
    }
  }, [recorderState, stopRecording]);

  // Also stop if the pointer leaves the button while held
  const handlePointerLeave = useCallback(() => {
    if (recorderState === "recording" && isHoldModeRef.current) {
      stopRecording();
      isHoldModeRef.current = false;
    }
  }, [recorderState, stopRecording]);

  // -------------------------------------------------------------------------
  // Keyboard support (Space / Enter to toggle)
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (recorderState === "idle") {
          isHoldModeRef.current = false;
          startRecording();
        } else if (recorderState === "recording") {
          stopRecording();
        }
      }
    },
    [recorderState, startRecording, stopRecording]
  );

  // -------------------------------------------------------------------------
  // Discard recording and return to idle
  // -------------------------------------------------------------------------
  const handleDiscard = () => {
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    setRecorderState("idle");
    setElapsedSeconds(0);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  // Still checking availability — render nothing to avoid flash
  if (isApiAvailable === null) return null;

  return (
    <div className="flex flex-col gap-3">
      {/* Section label */}
      {label && (
        <p className="text-sm font-medium text-gray-700">{label}</p>
      )}

      {/* API unavailability warning */}
      {!isApiAvailable && !apiWarningDismissed && (
        <InlineErrorBanner
          message="Voice recording is not supported in this browser. You can still submit the form without a voice note."
          onDismiss={() => setApiWarningDismissed(true)}
        />
      )}

      {/* Microphone permission / runtime error */}
      {recordingError && (
        <InlineErrorBanner
          message={recordingError}
          onDismiss={() => setRecordingError(null)}
        />
      )}

      {/* Record button — hidden when API is unavailable */}
      {isApiAvailable && recorderState !== "preview" && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            aria-label={
              recorderState === "recording"
                ? "Stop recording"
                : "Hold or tap to record"
            }
            aria-pressed={recorderState === "recording"}
            disabled={disabled}
            onClick={handleClick}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerLeave}
            onKeyDown={handleKeyDown}
            className={[
              // Base — minimum 44×44 tap target (Requirement 10.1)
              "relative flex h-16 w-16 items-center justify-center rounded-full",
              "transition-all duration-100 focus:outline-none focus:ring-4",
              // State-dependent styles
              recorderState === "recording"
                ? [
                    "bg-red-500 text-white shadow-lg",
                    "focus:ring-red-300",
                    // Pulse animation while recording (Requirement 10.5)
                    "animate-pulse",
                  ].join(" ")
                : [
                    "bg-blue-600 text-white shadow-md",
                    "hover:bg-blue-700 active:bg-blue-800",
                    "focus:ring-blue-300",
                    disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                  ].join(" "),
            ].join(" ")}
          >
            {recorderState === "recording" ? (
              <Square
                className="h-6 w-6 fill-current"
                aria-hidden="true"
              />
            ) : (
              <Mic className="h-6 w-6" aria-hidden="true" />
            )}

            {/* Recording ring animation */}
            {recorderState === "recording" && (
              <span
                aria-hidden="true"
                className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75"
              />
            )}
          </button>

          {/* Elapsed time / instruction label */}
          <p
            aria-live="polite"
            aria-atomic="true"
            className={`text-xs font-medium ${
              recorderState === "recording"
                ? "text-red-600"
                : "text-gray-500"
            }`}
          >
            {recorderState === "recording"
              ? `Recording… ${formatElapsed(elapsedSeconds)}`
              : "Hold or tap to record"}
          </p>

          {/* Screen-reader-only status */}
          <span className="sr-only" aria-live="assertive" aria-atomic="true">
            {recorderState === "recording" ? "Recording in progress" : ""}
          </span>
        </div>
      )}

      {/* Audio preview after recording */}
      {recorderState === "preview" && blobUrl && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-500">Preview</p>
          <InlineAudioPlayer src={blobUrl} onRemove={handleDiscard} />
          <p className="text-xs text-gray-400">
            Tap the × button to discard and re-record.
          </p>
        </div>
      )}
    </div>
  );
}
