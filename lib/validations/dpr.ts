import { z } from 'zod';

/**
 * Zod schema for DPR (Daily Progress Report) submission.
 * Validates: Requirements 7.1, 7.2, 7.6
 */
export const createDprSchema = z.object({
  planId: z.string({ required_error: 'planId is required' }).min(1, 'planId must not be empty'),
  masons: z.number({ required_error: 'Masons count is required', invalid_type_error: 'Masons must be a number' }).int('Masons must be an integer').min(0, 'Masons must be a non-negative integer'),
  helpers: z.number({ required_error: 'Helpers count is required', invalid_type_error: 'Helpers must be a number' }).int('Helpers must be an integer').min(0, 'Helpers must be a non-negative integer'),
  length: z.number({ required_error: 'Length is required', invalid_type_error: 'Length must be a number' }).positive('Length must be a positive number'),
  breadth: z.number({ required_error: 'Breadth is required', invalid_type_error: 'Breadth must be a number' }).positive('Breadth must be a positive number'),
  height: z.number({ required_error: 'Height is required', invalid_type_error: 'Height must be a number' }).positive('Height must be a positive number'),
  voiceRemarkUrl: z.string().optional(),
});

export type CreateDprInput = z.infer<typeof createDprSchema>;
