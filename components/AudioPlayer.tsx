"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

export interface AudioPlayerProps {
  /** URL of the audio file to play. */
  src: string;
  /** Accessible label for the audio element. */
  label?: string;
}

/**
 * AudioPlayer — HTML <audio> element with Tailwind-styled custom controls.
 *
 * Provides play/pause button, seek slider, and time display.
 * Minimum 44×44 tap target on the play/pause button (Requirement 10.1).
 *
 * Requirements: 10.5, 10.6
 */
export default function AudioPlayer({
  src,
  label = "Audio recording",
}: AudioPlayerProps) {
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
      audio.play().catch(() => {
        // Autoplay blocked — ignore
      });
    }
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "--:--";
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
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
        onTimeUpdate={() =>
          setCurrentTime(audioRef.current?.currentTime ?? 0)
        }
        onLoadedMetadata={() =>
          setDuration(audioRef.current?.duration ?? 0)
        }
        aria-label={label}
        preload="metadata"
      />

      {/* Play / Pause button — minimum 44×44 tap target (Requirement 10.1) */}
      <button
        type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors duration-100"
      >
        {isPlaying ? (
          <Pause className="h-5 w-5" aria-hidden="true" />
        ) : (
          <Play className="h-5 w-5" aria-hidden="true" />
        )}
      </button>

      {/* Progress bar + time */}
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
          aria-label="Seek"
          className="h-1.5 w-full cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500 tabular-nums">
          <span>{formatTime(currentTime)}</span>
          <span>{duration ? formatTime(duration) : "--:--"}</span>
        </div>
      </div>
    </div>
  );
}
