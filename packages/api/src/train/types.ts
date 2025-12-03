export interface TrainingItem {
  tenantId: string;
  sourceType: 'csv' | 'pdf' | 'docx' | 'json' | 'faq' | 'notice' | 'poi';
  title: string;
  text: string;
  metadata?: Record<string, any>;
}

export interface TextChunk {
  content: string;
  index: number;
  tokenCount: number;
  metadata?: Record<string, any>;
}

export interface EmbeddingResult {
  chunk: TextChunk;
  embedding: number[];
}

export interface IngestResult {
  success: boolean;
  chunksInserted: number;
  errors?: string[];
}

export interface TrainingJob {
  id: string;
  tenantId: string;
  developmentId?: string;
  fileName: string;
  fileType: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalChunks: number;
  processedChunks: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParseOptions {
  maxChunkSize?: number;
  chunkOverlap?: number;
}

export interface TrainingPipelineResult {
  success: boolean;
  tenantId: string;
  chunks: number;
  inserted: number;
  jobId?: string;
  error?: string;
}
