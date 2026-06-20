import { z } from 'zod';
import type { ParseResult } from '@/types';

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR']).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'OPERATOR']).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

export const addStockSchema = z.object({
  phone: z.string().min(10, 'Phone number required'),
  name: z.string().min(2, 'Distributor name required').optional(),
  receivedKg: z.number().positive('Quantity must be positive'),
  batchNo: z.string().optional(),
});

export const recordSaleSchema = z.object({
  distributorPhone: z.string().min(10, 'Distributor phone required'),
  farmerName: z.string().min(2, 'Farmer name required'),
  farmerMobile: z.string().min(10, 'Farmer mobile required'),
  cowCount: z.number().int().positive('Animal count must be positive'),
  qtyKg: z.number().positive('Quantity must be positive'),
  batchNo: z.string().optional(),
  saleDate: z.string().optional(),
});

export const createFarmerSchema = z.object({
  name: z.string().min(2).max(100),
  mobile: z.string().min(10).max(15),
  village: z.string().max(100).optional(),
  district: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  animalCount: z.number().int().min(0).optional(),
  animalType: z.enum(['Cow', 'Buffalo', 'Mixed', 'Other']).optional(),
  gender: z.enum(['Male', 'Female', 'Other']).optional(),
  distributorPhone: z.string().optional(),
});

function normalizeIndianPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

const phoneField = z
  .string()
  .min(10, 'Phone number required')
  .transform(normalizeIndianPhone)
  .refine((v) => /^91\d{10}$/.test(v), 'Enter a valid 10-digit Indian mobile number');

export const createDistributorSchema = z.object({
  phone: phoneField,
  name: z.string().min(2).max(100),
  email: z.string().email().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
});

export { normalizeIndianPhone };

export const sendMessageSchema = z.object({
  phone: z.string().min(10, 'Recipient phone required'),
  type: z.enum(['text', 'yesno', 'link', 'buttons', 'list']),
  message: z.string().min(1, 'Message text required').max(4096),
  mediaId: z.string().optional(),
  buttonOptions: z.array(z.string()).max(3).optional(),
  listTitle: z.string().optional(),
  listItems: z.array(z.object({ id: z.string(), title: z.string() })).max(10).optional(),
  linkUrl: z.string().url().optional(),
  linkTitle: z.string().optional(),
});

export const settingsSchema = z.object({
  key: z.string().min(1),
  value: z.unknown(),
  category: z.enum(['whatsapp', 'system', 'business', 'notifications']).optional(),
  label: z.string().optional(),
  description: z.string().optional(),
});

export function parseBody<T>(schema: z.ZodSchema<T>, data: unknown): ParseResult<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return { ok: false, errors };
  }
  return { ok: true, data: result.data };
}
