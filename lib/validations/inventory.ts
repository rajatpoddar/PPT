import { z } from 'zod';

export const createInventoryItemSchema = z.object({
  name: z
    .string({ required_error: 'Item name is required' })
    .trim()
    .min(1, 'Item name is required'),
  unit: z
    .string({ required_error: 'Unit is required' })
    .trim()
    .min(1, 'Unit is required'),
  totalQty: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .nonnegative('Quantity must be 0 or more'),
  note: z.string().trim().optional(),
});

export const updateInventoryItemSchema = z.object({
  name: z.string().trim().min(1, 'Item name is required').optional(),
  unit: z.string().trim().min(1, 'Unit is required').optional(),
  totalQty: z
    .number({ invalid_type_error: 'Quantity must be a number' })
    .nonnegative('Quantity must be 0 or more')
    .optional(),
  note: z.string().trim().optional(),
});

export const assignInventorySchema = z.object({
  itemId: z.string({ required_error: 'Item is required' }).min(1),
  siteId: z.string({ required_error: 'Site is required' }).min(1),
  quantity: z
    .number({ required_error: 'Quantity is required', invalid_type_error: 'Quantity must be a number' })
    .nonnegative('Quantity must be 0 or more'),
  note: z.string().trim().optional(),
});
