export * from './auth';
export * from './tenancy';
export * from './rate-limit';
export * from './vector-store';
export * from './utils';
export * from './chat/retrieval';
export * from './chat/prompt';
export * from './rag-service';
export * from './csv-mapper';
export * from './job-queue';
// Note: document-processor and train modules are NOT exported here
// because they depend on tesseract.js (heavy OCR library).
// Import them separately via '@openhouse/api/train' when needed.

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

// Training exports moved to '@openhouse/api/train' to avoid tesseract.js dependency
// Use: import { handleTrainRequest } from '@openhouse/api/train';

export {
  handleChatRequest
} from './chat';

export {
  handleTenantChat
} from './chat-tenant';

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
