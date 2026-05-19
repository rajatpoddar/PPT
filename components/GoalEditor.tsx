"use client";

import { useFieldArray, Control, FieldErrors } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

// ---------------------------------------------------------------------------
// GoalEditor
// ---------------------------------------------------------------------------

export interface GoalEditorProps {
  /** react-hook-form control from the parent form */
  control: Control<any>;
  /** Field array name, e.g. "goals" */
  name: string;
  /** Field errors from the parent form */
  errors?: FieldErrors<any>;
}

/**
 * GoalEditor — dynamic list of text inputs for plan goals.
 *
 * Uses react-hook-form's `useFieldArray` to manage the list. Each goal is a
 * plain text input. The user can add new goals and remove existing ones.
 * A minimum of 1 goal is required (enforced by the parent Zod schema).
 *
 * Requirements: 3.2, 10.1
 */
export default function GoalEditor({ control, name, errors }: GoalEditorProps) {
  const { fields, append, remove } = useFieldArray({ control, name });

  // Resolve nested error for the array itself (e.g. "At least one goal is required")
  const arrayError = errors?.[name];
  const arrayRootMessage =
    arrayError && !Array.isArray(arrayError)
      ? (arrayError as any)?.message ?? (arrayError as any)?.root?.message
      : undefined;

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="text-sm font-medium text-gray-700">Goals</legend>

      {/* Array-level validation message */}
      {arrayRootMessage && (
        <p role="alert" className="text-xs text-red-600">
          {arrayRootMessage}
        </p>
      )}

      <ul className="flex flex-col gap-2" aria-label="Goal list">
        {fields.map((field, index) => {
          // Per-item error message
          const itemError = Array.isArray(arrayError)
            ? (arrayError[index] as any)?.message
            : undefined;

          return (
            <li key={field.id} className="flex items-start gap-2">
              {/* Goal text input */}
              <div className="flex flex-1 flex-col gap-1">
                <input
                  {...control.register(`${name}.${index}`)}
                  type="text"
                  placeholder={`Goal ${index + 1}`}
                  aria-label={`Goal ${index + 1}`}
                  aria-invalid={!!itemError}
                  aria-describedby={
                    itemError ? `${name}-${index}-error` : undefined
                  }
                  className={[
                    // Minimum 44px height for tap target (Requirement 10.1)
                    "min-h-[44px] w-full rounded-lg border px-3 py-2.5 text-sm",
                    "placeholder:text-gray-400 focus:outline-none focus:ring-2",
                    itemError
                      ? "border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:ring-blue-500",
                  ].join(" ")}
                />
                {itemError && (
                  <p
                    id={`${name}-${index}-error`}
                    role="alert"
                    className="text-xs text-red-600"
                  >
                    {itemError}
                  </p>
                )}
              </div>

              {/* Remove button — only shown when there is more than 1 goal */}
              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length <= 1}
                aria-label={`Remove goal ${index + 1}`}
                className={[
                  // Minimum 44×44 tap target (Requirement 10.1)
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
                  "transition-colors duration-100 focus:outline-none focus:ring-2 focus:ring-red-400",
                  fields.length <= 1
                    ? "cursor-not-allowed text-gray-300"
                    : "text-red-500 hover:bg-red-50 active:bg-red-100",
                ].join(" ")}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Add goal button */}
      <button
        type="button"
        onClick={() => append("")}
        className={[
          // Minimum 44px height for tap target (Requirement 10.1)
          "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border-2",
          "border-dashed border-blue-300 px-4 py-2 text-sm font-medium text-blue-600",
          "transition-colors duration-100 hover:border-blue-400 hover:bg-blue-50",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-blue-100",
        ].join(" ")}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Goal
      </button>
    </fieldset>
  );
}
