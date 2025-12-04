export interface DocumentJob {
  documentId: string;
  tenantId: string;
  fileUrl: string;
  operation: 'ocr' | 'embed' | 'process';
}

export interface JobResult {
  success: boolean;
  documentId: string;
  error?: string;
  metadata?: Record<string, any>;
}
