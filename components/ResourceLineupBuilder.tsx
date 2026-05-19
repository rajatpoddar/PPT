"use client";

import { useFieldArray, Control, FieldErrors } from "react-hook-form";
import { Plus, Trash2 } from "lucide-react";

const DEFAULT_RESOURCES = [
  "JCB", "Water Tanker", "Cement", "Sand", "Cherry Picker",
  "Chips", "Stones", "Boulders", "Poplen", "Tractor", "Camper",
];

export interface ResourceLineupBuilderProps {
  control: Control<any>;
  name: string;
  errors?: FieldErrors<any>;
}

/**
 * ResourceLineupBuilder — dynamic list of resource name inputs for plan creation.
 * Includes default resource chips for quick selection.
 * Requirements: 3.3, 10.1
 */
export default function ResourceLineupBuilder({
  control,
  name,
  errors,
}: ResourceLineupBuilderProps) {
  const { fields, append, remove, replace } = useFieldArray({ control, name });

  const arrayError = errors?.[name];
  const arrayRootMessage =
    arrayError && !Array.isArray(arrayError)
      ? (arrayError as any)?.message ?? (arrayError as any)?.root?.message
      : undefined;

  // Get current resource names from fields
  const currentNames: string[] = fields.map((f: any) => f.name ?? "");

  function toggleDefault(resourceName: string) {
    const idx = currentNames.findIndex((n) => n === resourceName);
    if (idx !== -1) {
      // Remove it
      remove(idx);
    } else {
      // Add it — replace any trailing empty field first
      const emptyIdx = currentNames.findIndex((n) => n.trim() === "");
      if (emptyIdx !== -1) {
        // Replace the empty slot
        const updated = currentNames.map((n, i) => ({ name: i === emptyIdx ? resourceName : n }));
        replace(updated);
      } else {
        append({ name: resourceName });
      }
    }
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="text-sm font-medium text-gray-700">Resource Lineup</legend>

      {/* Default resource chips */}
      <div>
        <p className="mb-2 text-xs text-gray-500">Quick add — tap to add or remove:</p>
        <div className="flex flex-wrap gap-2">
          {DEFAULT_RESOURCES.map((resourceName) => {
            const isActive = currentNames.includes(resourceName);
            return (
              <button
                key={resourceName}
                type="button"
                onClick={() => toggleDefault(resourceName)}
                className={[
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors duration-100",
                  "focus:outline-none focus:ring-2 focus:ring-blue-500",
                  isActive
                    ? "border-blue-500 bg-blue-600 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-400 hover:bg-blue-50",
                ].join(" ")}
              >
                {resourceName}
              </button>
            );
          })}
        </div>
      </div>

      {/* Array-level validation message */}
      {arrayRootMessage && (
        <p role="alert" className="text-xs text-red-600">{arrayRootMessage}</p>
      )}

      {/* Manual resource inputs */}
      <ul className="flex flex-col gap-2" aria-label="Resource list">
        {fields.map((field, index) => {
          const itemErrors = Array.isArray(arrayError) ? (arrayError[index] as any) : undefined;
          const nameError = itemErrors?.name?.message;

          return (
            <li key={field.id} className="flex items-start gap-2">
              <div className="flex flex-1 flex-col gap-1">
                <input
                  {...control.register(`${name}.${index}.name`)}
                  type="text"
                  placeholder={`Resource ${index + 1} (e.g. JCB, Water Tanker)`}
                  aria-label={`Resource ${index + 1} name`}
                  aria-invalid={!!nameError}
                  aria-describedby={nameError ? `${name}-${index}-name-error` : undefined}
                  className={[
                    "min-h-[44px] w-full rounded-lg border px-3 py-2.5 text-sm",
                    "placeholder:text-gray-400 focus:outline-none focus:ring-2",
                    nameError
                      ? "border-red-400 focus:ring-red-400"
                      : "border-gray-300 focus:ring-blue-500",
                  ].join(" ")}
                />
                {nameError && (
                  <p id={`${name}-${index}-name-error`} role="alert" className="text-xs text-red-600">
                    {nameError}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => remove(index)}
                disabled={fields.length <= 1}
                aria-label={`Remove resource ${index + 1}`}
                className={[
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

      {/* Add custom resource button */}
      <button
        type="button"
        onClick={() => append({ name: "" })}
        className={[
          "flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border-2",
          "border-dashed border-blue-300 px-4 py-2 text-sm font-medium text-blue-600",
          "transition-colors duration-100 hover:border-blue-400 hover:bg-blue-50",
          "focus:outline-none focus:ring-2 focus:ring-blue-500 active:bg-blue-100",
        ].join(" ")}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add Custom Resource
      </button>
    </fieldset>
  );
}
