import { db } from '@openhouse/db/client';
import { training_jobs } from '@openhouse/db/schema';
import { TrainingJob } from './types';
import { sql, eq, and, desc } from 'drizzle-orm';

export async function createJob(
  tenantId: string,
  developmentId: string,
  fileName: string,
  fileType: string
): Promise<string> {
  const result = await db.insert(training_jobs).values({
    tenant_id: tenantId,
    development_id: developmentId,
    file_name: fileName,
    file_type: fileType,
    status: 'pending',
    progress: 0,
    total_chunks: 0,
    processed_chunks: 0,
  }).returning({ id: training_jobs.id });
  
  const jobId = result[0].id;
  console.log(`📋 Created training job: ${jobId}`);
  return jobId;
}

export async function updateJobStatus(
  jobId: string,
  status: 'processing' | 'completed' | 'failed',
  progress?: number,
  errorMessage?: string
): Promise<void> {
  const updates: any = {
    status,
    updated_at: new Date(),
  };
  
  if (status === 'processing' && !updates.started_at) {
    updates.started_at = new Date();
  }
  
  if (status === 'completed' || status === 'failed') {
    updates.completed_at = new Date();
    updates.progress = status === 'completed' ? 100 : progress || 0;
  }
  
  if (progress !== undefined) {
    updates.progress = progress;
  }
  
  if (errorMessage) {
    updates.error_message = errorMessage;
  }
  
  await db.update(training_jobs)
    .set(updates)
    .where(eq(training_jobs.id, jobId));
  
  console.log(`📊 Job ${jobId} status: ${status} (progress: ${updates.progress}%)`);
}

export async function updateJobProgress(
  jobId: string,
  processedChunks: number,
  totalChunks: number
): Promise<void> {
  const progress = totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 0;
  
  await db.update(training_jobs)
    .set({
      processed_chunks: processedChunks,
      total_chunks: totalChunks,
      progress,
      updated_at: new Date(),
    })
    .where(eq(training_jobs.id, jobId));
}

export async function getJob(jobId: string): Promise<TrainingJob | null> {
  const results = await db.select()
    .from(training_jobs)
    .where(eq(training_jobs.id, jobId))
    .limit(1);
  
  if (results.length === 0) {
    return null;
  }
  
  const job = results[0];
  return {
    id: job.id,
    tenantId: job.tenant_id,
    developmentId: job.development_id || undefined,
    fileName: job.file_name,
    fileType: job.file_type,
    status: job.status as any,
    progress: job.progress || 0,
    totalChunks: job.total_chunks || 0,
    processedChunks: job.processed_chunks || 0,
    errorMessage: job.error_message || undefined,
    startedAt: job.started_at || undefined,
    completedAt: job.completed_at || undefined,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

export async function getTenantJobs(
  tenantId: string,
  developmentId?: string,
  limit: number = 10
): Promise<TrainingJob[]> {
  const conditions = [eq(training_jobs.tenant_id, tenantId)];
  
  if (developmentId) {
    conditions.push(eq(training_jobs.development_id, developmentId));
  }
  
  const results = await db.select()
    .from(training_jobs)
    .where(and(...conditions))
    .orderBy(desc(training_jobs.created_at))
    .limit(limit);
  
  return results.map(job => ({
    id: job.id,
    tenantId: job.tenant_id,
    developmentId: job.development_id || undefined,
    file_name: job.file_name,
    fileName: job.file_name,
    fileType: job.file_type,
    status: job.status as any,
    progress: job.progress || 0,
    totalChunks: job.total_chunks || 0,
    processedChunks: job.processed_chunks || 0,
    errorMessage: job.error_message || undefined,
    startedAt: job.started_at || undefined,
    completedAt: job.completed_at || undefined,
    created_at: job.created_at,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  }));
}
