import { z } from 'zod';

export const createPaymentSchema = z.object({
  siteId: z.string({ required_error: 'Site is required' }).min(1, 'Site is required'),
  paymentDate: z
    .string({ required_error: 'Payment date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  workerType: z.enum(['MASON', 'HELPER'], {
    required_error: 'Worker type is required',
    invalid_type_error: 'Worker type must be MASON or HELPER',
  }),
  workerName: z.string().trim().optional(),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be positive'),
  note: z.string().trim().optional(),
});

export const createExpenseSchema = z.object({
  siteId: z.string({ required_error: 'Site is required' }).min(1, 'Site is required'),
  expenseDate: z
    .string({ required_error: 'Expense date is required' })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  category: z.enum(['MATERIAL', 'TRANSPORT', 'EQUIPMENT', 'OTHER'], {
    required_error: 'Category is required',
    invalid_type_error: 'Invalid category',
  }),
  description: z
    .string({ required_error: 'Description is required' })
    .trim()
    .min(1, 'Description is required'),
  amount: z
    .number({ required_error: 'Amount is required', invalid_type_error: 'Amount must be a number' })
    .positive('Amount must be positive'),
});
