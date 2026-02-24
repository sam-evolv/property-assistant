import { db } from '@openhouse/db/client';
import { training_jobs, documents } from '@openhouse/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { DocumentProcessor } from './document-processor';
import { logger } from './logger';
import { readFile } from 'fs/promises';
import path from 'path';

interface JobQueueConfig {
  pollInterval?: number;
  maxConcurrentJobs?: number;
  maxRetries?: number;
}

export class JobQueue {
  private static instance: JobQueue | null = null;
  private isRunning = false;
  private processingJobs = new Set<string>();
  private pollInterval: number;
  private maxConcurrentJobs: number;
  private maxRetries: number;
  private intervalHandle: NodeJS.Timeout | null = null;

  private constructor(config: JobQueueConfig = {}) {
    this.pollInterval = config.pollInterval || 5000;
    this.maxConcurrentJobs = config.maxConcurrentJobs || 3;
    this.maxRetries = config.maxRetries || 3;
  }

  static getInstance(config?: JobQueueConfig): JobQueue {
    if (!JobQueue.instance) {
      JobQueue.instance = new JobQueue(config);
    }
    return JobQueue.instance;
  }

  start(): void {
    if (this.isRunning) {
      logger.info('[JobQueue] Already running');
      return;
    }

    this.isRunning = true;
    logger.info(`[JobQueue] Started with poll interval: ${this.pollInterval}ms`);

    this.intervalHandle = setInterval(() => {
      this.processQueue().catch(error => {
        logger.error('[JobQueue] Error processing queue:', error);
      });
    }, this.pollInterval);

    this.processQueue().catch(error => {
      logger.error('[JobQueue] Error in initial queue processing:', error);
    });
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.isRunning = false;
    logger.info('[JobQueue] Stopped');
  }

  async enqueueDocumentProcessing(
    documentId: string,
    tenantId: string,
    filePath: string,
    developmentId?: string | null
  ): Promise<void> {
    try {
      await db.insert(training_jobs).values({
        tenant_id: tenantId,
        development_id: developmentId || null,
        file_name: filePath,
        file_type: 'document_processing',
        status: 'pending',
        progress: 0,
        total_chunks: 0,
        processed_chunks: 0,
      });

      logger.info(`[JobQueue] Enqueued document processing job for ${documentId}`);
    } catch (error: any) {
      logger.error(`[JobQueue] Failed to enqueue job`, { error: error.message });
      throw error;
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processingJobs.size >= this.maxConcurrentJobs) {
      return;
    }

    try {
      const availableSlots = this.maxConcurrentJobs - this.processingJobs.size;
      
      const pendingJobs = await db.query.training_jobs.findMany({
        where: eq(training_jobs.status, 'pending'),
        limit: availableSlots,
        orderBy: (jobs, { asc }) => [asc(jobs.created_at)],
      });

      for (const job of pendingJobs) {
        if (this.processingJobs.size >= this.maxConcurrentJobs) {
          break;
        }

        this.processJob(job).catch(error => {
          logger.error(`[JobQueue] Unhandled error processing job ${job.id}`, { error });
        });
      }
    } catch (error) {
      logger.error('[JobQueue] Error fetching pending jobs:', { error: String(error) });
    }
  }

  private async processJob(job: any): Promise<void> {
    const jobId = job.id;
    this.processingJobs.add(jobId);

    try {
      logger.info(`[JobQueue] Processing job ${jobId} (type: ${job.job_type})`);

      await db
        .update(training_jobs)
        .set({
          status: 'processing',
          started_at: new Date(),
        })
        .where(eq(training_jobs.id, jobId));

      if (job.job_type === 'document_processing') {
        await this.processDocumentJob(job);
      }

      await db
        .update(training_jobs)
        .set({
          status: 'completed',
          completed_at: new Date(),
        })
        .where(eq(training_jobs.id, jobId));

      logger.info(`[JobQueue] Job ${jobId} completed successfully`);
    } catch (error: any) {
      logger.error(`[JobQueue] Job ${jobId} failed`, { error: error.message });

      await db
        .update(training_jobs)
        .set({
          status: 'failed',
          error_message: error.message,
        })
        .where(eq(training_jobs.id, jobId));
    } finally {
      this.processingJobs.delete(jobId);
    }
  }

  private async processDocumentJob(job: any): Promise<void> {
    const fileName = job.file_name;
    
    // Find the document by file_name
    const document = await db.query.documents.findFirst({
      where: and(
        eq(documents.file_name, fileName),
        eq(documents.tenant_id, job.tenant_id)
      ),
    });

    if (!document) {
      throw new Error(`Document with file_name ${fileName} not found`);
    }

    const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads');
    const fullPath = path.join(uploadsDir, fileName);
    
    const buffer = await readFile(fullPath);

    const devId = document.development_id || null;

    const result = await DocumentProcessor.processDocument(
      document.id,
      buffer,
      document.mime_type || 'application/octet-stream',
      document.tenant_id,
      devId
    );

    // Update job progress
    await db
      .update(training_jobs)
      .set({
        total_chunks: result.chunksCreated,
        processed_chunks: result.chunksCreated,
        progress: 100,
      })
      .where(eq(training_jobs.id, job.id));
  }
}

let queueInstance: JobQueue | null = null;

export function initializeJobQueue(): void {
  if (!queueInstance) {
    queueInstance = JobQueue.getInstance({
      pollInterval: 5000,
      maxConcurrentJobs: 3,
      maxRetries: 3,
    });
    queueInstance.start();
  }
}

export function getJobQueue(): JobQueue {
  if (!queueInstance) {
    initializeJobQueue();
  }
  return queueInstance!;
}
