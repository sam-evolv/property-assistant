import type { DocumentJob, JobResult } from './types';

export async function processDocumentJob(job: DocumentJob): Promise<JobResult> {
  try {
    console.log(`Processing document ${job.documentId} for tenant ${job.tenantId}`);

    await simulateOCR(job.fileUrl);
    
    await simulateEmbedding(job.documentId);

    return {
      success: true,
      documentId: job.documentId,
      metadata: {
        processedAt: new Date().toISOString(),
        operation: job.operation,
      },
    };
  } catch (error: any) {
    console.error('Document processing error:', error);
    return {
      success: false,
      documentId: job.documentId,
      error: error.message,
    };
  }
}

async function simulateOCR(fileUrl: string): Promise<void> {
  console.log(`[OCR] Processing document from ${fileUrl}`);
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log('[OCR] Text extraction completed');
}

async function simulateEmbedding(documentId: string): Promise<void> {
  console.log(`[Embedding] Generating embeddings for document ${documentId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log('[Embedding] Embeddings stored successfully');
}
