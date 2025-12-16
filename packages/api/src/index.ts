export * from './auth';
export * from './tenancy';
export * from './rate-limit';
export * from './vector-store';
export * from './utils';
export * from './documents/index';
export * from './chat/retrieval';
export * from './chat/prompt';
export * from './rag-service';
export * from './csv-mapper';
export * from './job-queue';
export * from './document-processor';

// Document classification and mapping
export { classifyDocument, classifyByFilename } from './documents/classify-document';
export { autoMapFloorplanToHouseType, extractHouseTypeCodes } from './documents/map-floorplan-to-house-type';
export type { DocumentClassificationResult } from './documents/classify-document';
export type { HouseTypeMappingResult } from './documents/map-floorplan-to-house-type';

// Export session function and re-exported rbac types/functions
export { getAdminSession } from './session';
export type { AdminRole, AdminSession } from './session';
export type { AdminContext } from './rbac';

// Export rbac functions directly to avoid conflicts
export { 
  getAdminFromEmail,
  getAdminContext,
  isSuperAdmin,
  isDeveloper,
  isAdmin,
  canAccessAllTenants,
  canAccessTenant,
  canAccessDevelopment,
  createAdmin,
  getDevelopersByTenant,
  getAllDevelopers,
  getDevelopmentsByDeveloper
} from './rbac';

export type { CreateAdminParams } from './rbac';

export { handleGetSession } from './session-handler';

export { 
  handleGetDevelopments,
  handleCreateDevelopment,
  handleGetDevelopment,
  handleUpdateDevelopment,
  handleDeleteDevelopment
} from './developments';

export {
  handleTrainRequest,
  handleGetTrainingJobs
} from './train';

export {
  handleChatRequest
} from './chat';

export {
  handleTenantChat
} from './chat-tenant';

export {
  trainFromFile,
  getJob,
  getTenantJobs
} from './train/index';

export type { TrainingJob, TrainingPipelineResult } from './train/types';

// Floorplan storage and processing
export {
  processFloorplanUpload,
  uploadFloorplanToStorage,
  getFloorplanSignedUrl,
  extractHouseTypeCodeFromFilename,
  storeDimensionsInHouseType,
  getHouseTypeDimensions,
  ensureFloorplansBucketExists,
} from './floorplan-storage';
export type { FloorplanUploadResult, FloorplanDimensions } from './floorplan-storage';

// Error logging and analytics
export { logError, createErrorLogger, getRecentErrors, getErrorStats } from './error-logger';
export type { ErrorType, Severity } from './error-logger';
export { logAnalyticsEvent, getAnalyticsSummary, getUnansweredReport } from './analytics-logger';
export type { EventType } from './analytics-logger';
