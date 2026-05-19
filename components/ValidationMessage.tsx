export interface ValidationMessageProps {
  /** The validation error message to display. */
  message: string;
}

/**
 * ValidationMessage — field-level inline validation text.
 *
 * Renders below a form field to indicate a validation error.
 * Requirements: 10.5, 10.6
 */
export default function ValidationMessage({ message }: ValidationMessageProps) {
  return (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}
