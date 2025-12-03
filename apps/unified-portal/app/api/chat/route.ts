import { handleChatRequest } from '@openhouse/api/chat';

export const runtime = 'nodejs';
export const maxDuration = 60;

export const POST = handleChatRequest;
