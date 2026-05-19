'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { AlertCircle, X } from 'lucide-react';
import { createSiteSchema, type CreateSiteInput } from '@/lib/validations/site';

// ---------------------------------------------------------------------------
// Inline ValidationMessage (placeholder until shared component is built in 10.1)
// ---------------------------------------------------------------------------
function ValidationMessage({ message }: { message: string }) {
  return (
    <p role="alert" className="mt-1 text-xs text-red-600">
      {message}
    </p>
  );
}

// ---------------------------------------------------------------------------
// Inline ErrorBanner (placeholder until shared component is built in 10.1)
// ---------------------------------------------------------------------------
function ErrorBanner({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss error"
        className="ml-auto shrink-0 rounded p-0.5 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// NewSitePage — SiteForm
// ---------------------------------------------------------------------------
export default function NewSitePage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateSiteInput>({
    resolver: zodResolver(createSiteSchema),
  });

  const onSubmit = async (data: CreateSiteInput) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        router.push('/admin/sites');
        return;
      }

      if (res.status === 422) {
        const body = await res.json();
        const firstError =
          Object.values(body.errors as Record<string, string[]>)
            .flat()
            .at(0) ?? 'Validation failed. Please check your inputs.';
        setServerError(firstError);
        return;
      }

      if (res.status === 401 || res.status === 403) {
        setServerError('You are not authorised to create sites.');
        return;
      }

      setServerError('An unexpected error occurred. Please try again.');
    } catch {
      setServerError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      {/* Page heading */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Create New Site</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add a new construction site to the system.
        </p>
      </div>

      {/* Server-side error banner */}
      {serverError && (
        <div className="mb-6">
          <ErrorBanner
            message={serverError}
            onDismiss={() => setServerError(null)}
          />
        </div>
      )}

      <form
        onSubmit={handleSubmit(onSubmit)}
        noValidate
        className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200 space-y-5"
      >
        {/* Site name field */}
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Site Name <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="name"
            type="text"
            autoComplete="off"
            aria-describedby={errors.name ? 'name-error' : undefined}
            aria-invalid={!!errors.name}
            aria-required="true"
            {...register('name')}
            className={[
              'block w-full rounded-md border px-3 py-3 text-sm text-gray-900',
              'placeholder-gray-400 shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'min-h-[44px]', // mobile tap target ≥ 44px
              errors.name
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 bg-white',
            ].join(' ')}
            placeholder="e.g. Riverside Tower Block A"
          />
          {errors.name && (
            <span id="name-error">
              <ValidationMessage message={errors.name.message!} />
            </span>
          )}
        </div>

        {/* Location field */}
        <div>
          <label
            htmlFor="location"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Location <span aria-hidden="true" className="text-red-500">*</span>
          </label>
          <input
            id="location"
            type="text"
            autoComplete="off"
            aria-describedby={errors.location ? 'location-error' : undefined}
            aria-invalid={!!errors.location}
            aria-required="true"
            {...register('location')}
            className={[
              'block w-full rounded-md border px-3 py-3 text-sm text-gray-900',
              'placeholder-gray-400 shadow-sm',
              'focus:outline-none focus:ring-2 focus:ring-blue-500',
              'min-h-[44px]', // mobile tap target ≥ 44px
              errors.location
                ? 'border-red-400 bg-red-50'
                : 'border-gray-300 bg-white',
            ].join(' ')}
            placeholder="e.g. 12 Harbour Road, Mumbai"
          />
          {errors.location && (
            <span id="location-error">
              <ValidationMessage message={errors.location.message!} />
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 pt-2 sm:flex-row-reverse">
          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={[
              'flex w-full items-center justify-center rounded-md px-4 py-3',
              'min-h-[44px] text-sm font-semibold text-white sm:w-auto',
              'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              isSubmitting
                ? 'cursor-not-allowed bg-blue-400'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
            ].join(' ')}
          >
            {isSubmitting ? (
              <>
                <svg
                  className="mr-2 h-4 w-4 animate-spin"
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
                Creating…
              </>
            ) : (
              'Create Site'
            )}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={() => router.push('/admin/sites')}
            className={[
              'flex w-full items-center justify-center rounded-md border border-gray-300',
              'bg-white px-4 py-3 min-h-[44px] text-sm font-medium text-gray-700 sm:w-auto',
              'hover:bg-gray-50 active:bg-gray-100',
              'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            ].join(' ')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
