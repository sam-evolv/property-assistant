import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const emailSchema = z.string().email();

export const tenantSlugSchema = z.string().min(2).max(100).regex(/^[a-z0-9-]+$/);

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500).optional(),
  tenant_id: uuidSchema.optional(),
  development_id: uuidSchema.optional(),
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  developmentId: uuidSchema.optional(),
  houseId: uuidSchema.optional(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).optional(),
});

export const documentUploadSchema = z.object({
  name: z.string().min(1).max(255),
  file_type: z.enum(['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/csv']),
  size: z.number().int().positive().max(50 * 1024 * 1024), // 50MB max
  development_id: uuidSchema,
  category: z.enum(['manual', 'warranty', 'design', 'technical', 'legal', 'other']).optional(),
});

export const developerCreateSchema = z.object({
  email: emailSchema,
  tenantSlug: tenantSlugSchema,
  role: z.enum(['developer', 'admin']).default('developer'),
});

export const homeownerCreateSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(255),
  development_id: uuidSchema,
  house_type: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
});

export const developmentCreateSchema = z.object({
  name: z.string().min(1).max(255),
  location: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  units_count: z.number().int().positive().max(10000).optional(),
});

export const qrResolveSchema = z.object({
  token: z.string().min(10).max(500),
});

export const analyticsQuerySchema = z.object({
  tenant_id: uuidSchema.optional(),
  development_id: uuidSchema.optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  granularity: z.enum(['hour', 'day', 'week', 'month']).optional(),
});

export const trainingJobSchema = z.object({
  development_id: uuidSchema,
  document_ids: z.array(uuidSchema).min(1).max(100),
  force_reprocess: z.boolean().default(false),
});

export const bulkImportSchema = z.object({
  development_id: uuidSchema,
  data: z.array(z.record(z.string(), z.any())).min(1).max(1000),
  overwrite: z.boolean().default(false),
});

export const ipAddressSchema = z.string().regex(
  /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/,
  'Invalid IP address'
);

export const urlSchema = z.string().url().max(2048);

export const sanitizedTextSchema = z.string().max(10000).transform((val) => {
  return val
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '');
});

export const fileNameSchema = z.string()
  .min(1)
  .max(255)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid file name format');

export const csvRowSchema = z.object({
  name: z.string().min(1),
  email: emailSchema.optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
}).passthrough();
