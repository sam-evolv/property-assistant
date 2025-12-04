import { NextRequest, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

export class ValidationError extends Error {
  constructor(
    public issues: z.ZodIssue[],
    message: string = 'Validation failed'
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function validateBody<T extends z.ZodType>(
  schema: T
): (request: NextRequest) => Promise<z.infer<T>> {
  return async (request: NextRequest) => {
    try {
      const body = await request.json();
      return schema.parse(body);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(error.issues);
      }
      throw error;
    }
  };
}

export function validateQuery<T extends z.ZodType>(
  schema: T
): (request: NextRequest) => z.infer<T> {
  return (request: NextRequest) => {
    try {
      const { searchParams } = new URL(request.url);
      const params = Object.fromEntries(searchParams.entries());
      return schema.parse(params);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(error.issues);
      }
      throw error;
    }
  };
}

export function validateFormData<T extends z.ZodType>(
  schema: T
): (formData: FormData) => z.infer<T> {
  return (formData: FormData) => {
    try {
      const data = Object.fromEntries(formData.entries());
      return schema.parse(data);
    } catch (error) {
      if (error instanceof ZodError) {
        throw new ValidationError(error.issues);
      }
      throw error;
    }
  };
}

export function handleValidationError(error: unknown): NextResponse {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  if (error instanceof Error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 }
    );
  }

  return NextResponse.json(
    { error: 'Invalid request data' },
    { status: 400 }
  );
}

export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/<embed[^>]*>/gi, '')
    .replace(/<object[^>]*>.*?<\/object>/gi, '');
}

export function sanitizeFileName(fileName: string): string {
  return fileName
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 255);
}

export const ALLOWED_MIME_TYPES = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  csv: 'text/csv',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  json: 'application/json',
} as const;

export function validateMimeType(mimeType: string, allowedTypes: string[]): boolean {
  return allowedTypes.includes(mimeType);
}

export const FILE_SIZE_LIMITS = {
  document: 50 * 1024 * 1024, // 50MB
  image: 10 * 1024 * 1024, // 10MB
  csv: 25 * 1024 * 1024, // 25MB
  general: 100 * 1024 * 1024, // 100MB
} as const;

export function validateFileSize(size: number, limit: number): boolean {
  return size > 0 && size <= limit;
}
