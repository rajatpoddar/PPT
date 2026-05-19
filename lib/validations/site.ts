import { z } from 'zod';

/**
 * Zod schema for site creation.
 *
 * - name: required, non-empty after trimming whitespace
 * - location: required, non-empty after trimming whitespace
 *
 * Validates: Requirements 2.4
 */
export const createSiteSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(1, 'Name must not be empty'),
  location: z
    .string({ required_error: 'Location is required' })
    .trim()
    .min(1, 'Location must not be empty'),
});

export type CreateSiteInput = z.infer<typeof createSiteSchema>;
