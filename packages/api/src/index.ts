export * from './auth';
export * from './tenancy';
export * from './rate-limit';
export * from './vector-store';
export * from './utils';
export * from './documents';
export * from './chat/retrieval';
export * from './chat/prompt';
export * from './rag-service';
export * from './csv-mapper';
export * from './job-queue';
export * from './document-processor';

// Export session function and re-exported rbac types/functions
export { getAdminSession } from './session';
export type { AdminRole, AdminContext, AdminSession } from './session';

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

// Document classification and mapping
export { classifyDocument, classifyByFilename } from './documents/classify-document';
export { autoMapFloorplanToHouseType, extractHouseTypeCodes } from './documents/map-floorplan-to-house-type';
export type { DocumentClassificationResult } from './documents/classify-document';
export type { HouseTypeMappingResult } from './documents/map-floorplan-to-house-type';
