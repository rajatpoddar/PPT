export interface LoadingSpinnerProps {
  /** Accessible label for screen readers. */
  label?: string;
  /** Size variant. */
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "h-3 w-3",
  md: "h-4 w-4",
  lg: "h-6 w-6",
};

/**
 * LoadingSpinner — inline spinner shown during file uploads and form submissions.
 *
 * Requirements: 10.5, 10.6
 */
export default function LoadingSpinner({
  label = "Loading…",
  size = "md",
}: LoadingSpinnerProps) {
  return (
    <span
      role="status"
      aria-label={label}
      className="inline-flex items-center gap-2 text-sm text-gray-500"
    >
      <svg
        className={`${sizeClasses[size]} animate-spin text-blue-600`}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
        />
      </svg>
      <span>{label}</span>
    </span>
  );
}
