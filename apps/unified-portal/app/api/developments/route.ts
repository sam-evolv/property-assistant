import { handleGetDevelopments, handleCreateDevelopment } from '@openhouse/api/developments';

export const runtime = 'nodejs';

export const GET = handleGetDevelopments;
export const POST = handleCreateDevelopment;
