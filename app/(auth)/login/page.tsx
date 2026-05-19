'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { AlertCircle, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Zod schema — both fields must be non-empty strings
// ---------------------------------------------------------------------------
const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// Inline ErrorBanner (placeholder until the shared component is built in 10.1)
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
// Role → dashboard route mapping
// ---------------------------------------------------------------------------
const ROLE_REDIRECT: Record<string, string> = {
  ADMIN: '/admin/dashboard',
  SUPERVISOR: '/supervisor/execution',
};

// ---------------------------------------------------------------------------
// LoginPage
// ---------------------------------------------------------------------------
export default function LoginPage() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    setIsSubmitting(true);

    try {
      const result = await signIn('credentials', {
        redirect: false,
        username: data.username,
        password: data.password,
      });

      if (result?.error) {
        setServerError('Invalid username or password. Please try again.');
        return;
      }

      if (result?.ok) {
        // Fetch the session to read the role, then redirect accordingly.
        // getSession is not available in the client bundle without importing
        // from next-auth/react, so we call the session endpoint directly.
        const sessionRes = await fetch('/api/auth/session');
        const session = await sessionRes.json();
        const role: string = session?.user?.role ?? '';
        const destination = ROLE_REDIRECT[role] ?? '/';
        router.push(destination);
      }
    } catch {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        {/* Heading */}
        <h1 className="mb-2 text-center text-2xl font-bold text-gray-900">
          PPT Builders
        </h1>
        <p className="mb-8 text-center text-sm text-gray-500">
          Sign in to your account
        </p>

        {/* Server-side error banner */}
        {serverError && (
          <div className="mb-6">
            <ErrorBanner
              message={serverError}
              onDismiss={() => setServerError(null)}
            />
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
          {/* Username field */}
          <div>
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              aria-describedby={errors.username ? 'username-error' : undefined}
              aria-invalid={!!errors.username}
              {...register('username')}
              className={[
                'block w-full rounded-md border px-3 py-3 text-sm text-gray-900',
                'placeholder-gray-400 shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'min-h-[44px]', // mobile tap target
                errors.username
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white',
              ].join(' ')}
              placeholder="Enter your username"
            />
            {errors.username && (
              <p
                id="username-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {errors.username.message}
              </p>
            )}
          </div>

          {/* Password field */}
          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              aria-describedby={errors.password ? 'password-error' : undefined}
              aria-invalid={!!errors.password}
              {...register('password')}
              className={[
                'block w-full rounded-md border px-3 py-3 text-sm text-gray-900',
                'placeholder-gray-400 shadow-sm',
                'focus:outline-none focus:ring-2 focus:ring-blue-500',
                'min-h-[44px]', // mobile tap target
                errors.password
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-300 bg-white',
              ].join(' ')}
              placeholder="Enter your password"
            />
            {errors.password && (
              <p
                id="password-error"
                role="alert"
                className="mt-1 text-xs text-red-600"
              >
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={[
              'flex w-full items-center justify-center rounded-md px-4 py-3',
              'min-h-[44px] text-sm font-semibold text-white',
              'transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
              isSubmitting
                ? 'cursor-not-allowed bg-blue-400'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
            ].join(' ')}
          >
            {isSubmitting ? (
              <>
                {/* Inline spinner */}
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
                Signing in…
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
