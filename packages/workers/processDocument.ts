import type { DocumentJob, JobResult } from './types';

export async function processDocumentJob(job: DocumentJob): Promise<JobResult> {
  try {
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
    return {
      success: false,
      documentId: job.documentId,
      error: error.message,
    };
  }
}

async function simulateOCR(fileUrl: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 1000));
}

async function simulateEmbedding(documentId: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 500));
}
