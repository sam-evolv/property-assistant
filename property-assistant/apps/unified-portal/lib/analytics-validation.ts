import { z } from 'zod';
import { NextResponse } from 'next/server';

// Custom error for validation failures (returns 400 instead of 500)
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export const analyticsQuerySchema = z.object({
  tenantId: z.string().uuid('Invalid tenant ID format').optional(),
  developmentId: z.string().uuid('Invalid development ID format').optional(),
  days: z.coerce.number().min(1).max(3650).default(30),
  limit: z.coerce.number().min(1).max(100).default(20),
  platformWide: z.coerce.boolean().default(false), // Allow super-admin platform-wide queries
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export const overviewResponseSchema = z.object({
  totalDevelopments: z.number().min(0),
  totalMessages: z.number().min(0),
  totalHomeowners: z.number().min(0),
  totalDocuments: z.number().min(0),
  activeUsers: z.number().min(0),
  avgResponseTime: z.number().min(0),
  avgCostPerMessage: z.number().min(0),
  satisfactionScore: z.number().min(0).max(5),
  peakUsageHour: z.number().min(0).max(23),
  topDevelopment: z.string(),
  embeddingChunks: z.number().min(0),
});

export const documentMetricsSchema = z.object({
  totalDocuments: z.number().min(0),
  avgHealthScore: z.number().min(0).max(100),
  documentsByStatus: z.record(z.string(), z.number()),
  topAccessedDocs: z.array(z.object({
    name: z.string(),
    access_count: z.number(),
  })),
});

export const unitMetricsSchema = z.object({
  totalUnits: z.number().min(0),
  occupiedUnits: z.number().min(0),
  unitsWithActivity: z.number().min(0),
  avgMessagesPerUnit: z.number().min(0),
  topActiveUnit: z.string().nullable(),
});

export const homeownerMetricsSchema = z.object({
  totalHomeowners: z.number().min(0),
  activeHomeowners: z.number().min(0),
  avgChatsPerHomeowner: z.number().min(0),
  topHomeowner: z.object({
    name: z.string(),
    total_chats: z.number(),
  }).nullable(),
});

export function safeAnalyticsResponse<T>(data: T, schema: z.ZodSchema<T>) {
  try {
    const validated = schema.parse(data);
    return NextResponse.json(validated);
  } catch (error) {
    console.error('[Analytics Validation Error]', error);
    return NextResponse.json(
      { error: 'Invalid response data', safeFallback: true },
      { status: 200 }
    );
  }
}

export function handleAnalyticsError(error: unknown, context: string) {
  console.error(`[Analytics Error - ${context}]`, error);
  
  const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
  
  // Return 400 for ValidationError or validation-related errors, 500 for unexpected server errors
  const isValidationError = error instanceof ValidationError || 
                           (error instanceof Error && (
                             error.message.includes('Invalid query parameters') ||
                             error.message.includes('tenant isolation') ||
                             error.message.includes('tenantId') ||
                             error.message.includes('developmentId')
                           ));
  const status = isValidationError ? 400 : 500;
  
  return NextResponse.json(
    {
      error: `Failed to fetch ${context}`,
      details: isValidationError ? errorMessage : 'Internal server error',
      safeFallback: !isValidationError,
      timestamp: new Date().toISOString(),
    },
    { status }
  );
}

export function validateAnalyticsQuery(searchParams: URLSearchParams) {
  const params = {
    tenantId: searchParams.get('tenantId') || undefined,
    developmentId: searchParams.get('developmentId') || undefined,
    days: searchParams.get('days') || '30',
    limit: searchParams.get('limit') || '20',
    platformWide: searchParams.get('platformWide') || 'false', // Extract platformWide param
  };

  const result = analyticsQuerySchema.safeParse(params);
  
  if (!result.success) {
    const errors = result.error.issues.map((issue) => 
      `${String(issue.path.join(''))}: ${issue.message}`
    ).join(', ');
    throw new Error(`Invalid query parameters: ${errors}`);
  }
  
  // Enforce tenant isolation unless explicitly platformWide
  return ensureTenantIsolation(result.data);
}

export function ensureTenantIsolation<T extends { tenantId?: string; developmentId?: string; platformWide?: boolean }>(query: T): T {
  // Allow platform-wide queries only when explicitly requested (super-admin context)
  if (!query.platformWide && !query.tenantId && !query.developmentId) {
    throw new ValidationError('Either tenantId or developmentId must be provided for tenant isolation (or set platformWide=true for super-admin)');
  }
  return query;
}

export function calculateStartDate(days: number): Date {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  return startDate;
}

export function safeNumber(value: unknown, fallback: number = 0): number {
  const num = Number(value);
  return isNaN(num) || !isFinite(num) ? fallback : num;
}

export function safeString(value: unknown, fallback: string = 'N/A'): string {
  return value != null && String(value).trim() !== '' ? String(value) : fallback;
}

export function safeDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? new Date() : date;
  }
  return new Date();
}
