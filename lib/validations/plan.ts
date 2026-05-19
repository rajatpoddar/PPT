import { z } from 'zod';

/**
 * Zod schema for plan creation.
 *
 * - siteId: required, non-empty string
 * - date: ISO date string (e.g. "2024-01-15"), transformed to a Date at midnight UTC
 * - goals: array of non-empty strings, minimum 1 item
 * - resources: array of objects with a non-empty `name`, minimum 1 item
 * - voiceNoteUrl: optional string
 *
 * Validates: Requirements 3.1, 3.6, 3.7
 */
export const createPlanSchema = z.object({
  siteId: z
    .string({ required_error: 'Site is required' })
    .trim()
    .min(1, 'Site must not be empty'),

  date: z
    .string({ required_error: 'Date is required' })
    .trim()
    .min(1, 'Date must not be empty')
    .transform((val, ctx) => {
      // Expect an ISO date string like "2024-01-15"
      const parsed = new Date(`${val}T00:00:00.000Z`);
      if (isNaN(parsed.getTime())) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Date must be a valid ISO date string (e.g. "2024-01-15")',
        });
        return z.NEVER;
      }
      return parsed;
    }),

  goals: z
    .array(
      z
        .string({ required_error: 'Goal must be a string' })
        .trim()
        .min(1, 'Goal must not be empty'),
      { required_error: 'Goals are required' }
    )
    .min(1, 'At least one goal is required'),

  resources: z
    .array(
      z.object({
        name: z
          .string({ required_error: 'Resource name is required' })
          .trim()
          .min(1, 'Resource name must not be empty'),
      }),
      { required_error: 'Resources are required' }
    )
    .min(1, 'At least one resource is required'),

  voiceNoteUrl: z.string().optional(),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
