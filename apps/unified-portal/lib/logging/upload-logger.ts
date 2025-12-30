import { nanoid } from 'nanoid';

export type UploadPhase = 
  | 'upload_start'
  | 'storage_upload'
  | 'db_write'
  | 'text_extraction'
  | 'indexing'
  | 'verification'
  | 'upload_complete';

export type UploadStatus = 'started' | 'success' | 'failed';

export interface UploadLogEntry {
  uploadId: string;
  phase: UploadPhase;
  status: UploadStatus;
  fileName: string;
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, any>;
  error?: string;
}

export interface FileUploadResult {
  fileName: string;
  success: boolean;
  documentId?: string;
  chunksIndexed?: number;
  totalChunks?: number;
  error?: string;
  indexingErrors?: string[];
  phases: {
    storage: 'pending' | 'success' | 'failed';
    dbWrite: 'pending' | 'success' | 'failed';
    indexing: 'pending' | 'success' | 'failed' | 'partial';
    verification: 'pending' | 'success' | 'failed';
  };
}

export class UploadLogger {
  private uploadId: string;
  private fileName: string;
  private startTime: number;
  private phaseStartTime: number;
  private phases: FileUploadResult['phases'];

  constructor(fileName: string) {
    this.uploadId = nanoid(12);
    this.fileName = fileName;
    this.startTime = Date.now();
    this.phaseStartTime = Date.now();
    this.phases = {
      storage: 'pending',
      dbWrite: 'pending',
      indexing: 'pending',
      verification: 'pending',
    };
  }

  private log(phase: UploadPhase, status: UploadStatus, metadata?: Record<string, any>, error?: string): void {
    const now = Date.now();
    const entry: UploadLogEntry = {
      uploadId: this.uploadId,
      phase,
      status,
      fileName: this.fileName,
      timestamp: new Date().toISOString(),
      durationMs: now - this.phaseStartTime,
      metadata,
      error,
    };

    const prefix = status === 'failed' ? '[UPLOAD:ERROR]' : '[UPLOAD]';
    console.log(prefix, JSON.stringify(entry));
    
    this.phaseStartTime = now;
  }

  logStart(metadata?: Record<string, any>): void {
    this.log('upload_start', 'started', {
      ...metadata,
      uploadId: this.uploadId,
    });
  }

  logStorageSuccess(storagePath: string, fileUrl: string): void {
    this.phases.storage = 'success';
    this.log('storage_upload', 'success', { storagePath, fileUrl });
  }

  logStorageFailure(error: string): void {
    this.phases.storage = 'failed';
    this.log('storage_upload', 'failed', undefined, error);
  }

  logDbWriteSuccess(documentId: string): void {
    this.phases.dbWrite = 'success';
    this.log('db_write', 'success', { documentId });
  }

  logDbWriteFailure(error: string): void {
    this.phases.dbWrite = 'failed';
    this.log('db_write', 'failed', undefined, error);
  }

  logTextExtraction(textLength: number, pages?: number): void {
    this.log('text_extraction', 'success', { textLength, pages });
  }

  logTextExtractionFailure(error: string): void {
    this.log('text_extraction', 'failed', undefined, error);
  }

  logIndexingProgress(chunkIndex: number, totalChunks: number): void {
    this.log('indexing', 'started', { chunkIndex, totalChunks });
  }

  logIndexingComplete(successCount: number, totalChunks: number): void {
    if (successCount === 0) {
      this.phases.indexing = 'failed';
      this.log('indexing', 'failed', { successCount, totalChunks });
    } else if (successCount < totalChunks) {
      this.phases.indexing = 'partial';
      this.log('indexing', 'success', { successCount, totalChunks, partial: true });
    } else {
      this.phases.indexing = 'success';
      this.log('indexing', 'success', { successCount, totalChunks });
    }
  }

  logIndexingFailure(error: string): void {
    this.phases.indexing = 'failed';
    this.log('indexing', 'failed', undefined, error);
  }

  logVerificationSuccess(documentId: string, sectionsCount: number): void {
    this.phases.verification = 'success';
    this.log('verification', 'success', { documentId, sectionsCount });
  }

  logVerificationFailure(error: string): void {
    this.phases.verification = 'failed';
    this.log('verification', 'failed', undefined, error);
  }

  logComplete(
    success: boolean, 
    documentId?: string, 
    chunksIndexed?: number, 
    totalChunks?: number, 
    error?: string,
    indexingErrors?: string[]
  ): FileUploadResult {
    const totalDuration = Date.now() - this.startTime;
    
    this.log('upload_complete', success ? 'success' : 'failed', {
      totalDurationMs: totalDuration,
      documentId,
      chunksIndexed,
      totalChunks,
      indexingErrorCount: indexingErrors?.length || 0,
    }, error);

    return {
      fileName: this.fileName,
      success,
      documentId,
      chunksIndexed,
      totalChunks,
      error,
      indexingErrors: indexingErrors && indexingErrors.length > 0 ? indexingErrors : undefined,
      phases: { ...this.phases },
    };
  }

  getPhases(): FileUploadResult['phases'] {
    return { ...this.phases };
  }

  getUploadId(): string {
    return this.uploadId;
  }
}

export function createUploadLogger(fileName: string): UploadLogger {
  return new UploadLogger(fileName);
}
