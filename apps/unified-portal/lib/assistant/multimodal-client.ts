'use client';

/**
 * Client side orchestration for sending a chat message that includes
 * attached images. Sprint 1 of Assistant V2, section 7.3 of the spec.
 *
 * Pipeline:
 *   1. Compress each selected file via the canvas resize step (only
 *      kicks in for files larger than the threshold). Required because
 *      Vercel's serverless body cap is 4.5 MB and iPhone photos sail
 *      past that; see attachments.ts for the architectural notes.
 *   2. POST /api/assistant/media/upload  (multipart, one to six files)
 *   3. POST /api/assistant/chat/multimodal  (json, message text + media ids)
 *
 * The caller passes an onStatus callback so the UI can swap the rotating
 * status strip ("Preparing photos" then "Uploading photos" then
 * "Reviewing your home information" then "Preparing the response"). Each
 * label transitions only when its phase actually starts. No fake progress.
 *
 * Errors:
 *   - Any 4xx or 5xx surfaces a SendMultimodalError with a resident-facing
 *     message. The exact string for an upload failure comes from section
 *     7.5 of the spec.
 */

import { compressSelectionsForUpload, type SelectedAttachment } from './attachments';

export type MultimodalStatus =
  | 'compressing'
  | 'uploading'
  | 'reviewing'
  | 'preparing';

export interface SendMultimodalInput {
  conversationId: string;
  unitId: string;
  qrToken: string;
  messageText: string;
  selections: SelectedAttachment[];
  onStatus?: (status: MultimodalStatus) => void;
}

export interface UploadedMedia {
  media_id: string;
  signed_url: string;
  thumbnail_url: string;
  width: number | null;
  height: number | null;
}

export interface SendMultimodalResult {
  messageId: string;
  conversationId: string;
  media: UploadedMedia[];
  assistantMessage: string;
  analysisId: string;
  action: string;
}

export class SendMultimodalError extends Error {
  constructor(public residentMessage: string, public stage: 'upload' | 'chat') {
    super(residentMessage);
    this.name = 'SendMultimodalError';
  }
}

const UPLOAD_FAILED_MESSAGE =
  "Couldn't upload that photo. Try again or come back to it later.";
const CHAT_FAILED_MESSAGE =
  "Couldn't send the message. Try again or come back to it later.";

export async function sendMultimodal(input: SendMultimodalInput): Promise<SendMultimodalResult> {
  const { conversationId, unitId, qrToken, messageText, selections, onStatus } = input;

  // Text-only turns (no attachments) skip the compress + upload steps entirely
  // and post straight to the chat route with empty media_ids. This is the path
  // PurchaserChatTab uses when the OpenHouse agent flag is on, so a text-only
  // message goes through the agent route (which has conversation memory) rather
  // than the RAG /api/chat endpoint. The multimodal route accepts empty
  // media_ids on the agent path.
  const textOnly = selections.length === 0;

  let media: UploadedMedia[] = [];
  let uploadedMessageId: string | undefined;

  if (!textOnly) {
    onStatus?.('compressing');
    // compressSelectionsForUpload is a no-op for files already under the
    // threshold and for browsers that cannot decode the source format
    // (HEIC on Chrome and Firefox), so this is always safe to call.
    const compressed = await compressSelectionsForUpload(selections);

    onStatus?.('uploading');

    const form = new FormData();
    form.set('conversation_id', conversationId);
    form.set('unit_id', unitId);
    for (const sel of compressed) {
      form.append('files', sel.file, sel.file.name);
    }

    let uploadJson: {
      message_id?: string;
      media?: UploadedMedia[];
    };
    try {
      const uploadRes = await fetch('/api/assistant/media/upload', {
        method: 'POST',
        headers: { 'x-qr-token': qrToken },
        body: form,
      });
      if (!uploadRes.ok) {
        let serverMessage = UPLOAD_FAILED_MESSAGE;
        try {
          const errJson = await uploadRes.json();
          if (typeof errJson?.error === 'string' && errJson.error.length > 0 && errJson.error.length < 200) {
            serverMessage = errJson.error;
          }
        } catch {
          // ignore json parse failure
        }
        throw new SendMultimodalError(serverMessage, 'upload');
      }
      uploadJson = await uploadRes.json();
    } catch (err) {
      if (err instanceof SendMultimodalError) throw err;
      throw new SendMultimodalError(UPLOAD_FAILED_MESSAGE, 'upload');
    }

    media = Array.isArray(uploadJson.media) ? uploadJson.media : [];
    if (media.length === 0) {
      throw new SendMultimodalError(UPLOAD_FAILED_MESSAGE, 'upload');
    }
    uploadedMessageId = uploadJson.message_id;
  }

  onStatus?.('reviewing');

  let chatJson: {
    message?: string;
    analysis_id?: string;
    action?: string;
    message_id?: string;
    conversation_id?: string;
  };
  try {
    onStatus?.('preparing');
    const chatRes = await fetch('/api/assistant/chat/multimodal', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-qr-token': qrToken,
      },
      body: JSON.stringify({
        conversation_id: conversationId,
        unit_id: unitId,
        message_text: messageText,
        media_ids: media.map((m) => m.media_id),
        message_id: uploadedMessageId,
      }),
    });
    if (!chatRes.ok) {
      let serverMessage = CHAT_FAILED_MESSAGE;
      try {
        const errJson = await chatRes.json();
        if (typeof errJson?.error === 'string' && errJson.error.length > 0 && errJson.error.length < 200) {
          serverMessage = errJson.error;
        }
      } catch {
        // ignore
      }
      throw new SendMultimodalError(serverMessage, 'chat');
    }
    chatJson = await chatRes.json();
  } catch (err) {
    if (err instanceof SendMultimodalError) throw err;
    throw new SendMultimodalError(CHAT_FAILED_MESSAGE, 'chat');
  }

  return {
    messageId: chatJson.message_id ?? uploadedMessageId ?? '',
    conversationId: chatJson.conversation_id ?? conversationId,
    media,
    assistantMessage: typeof chatJson.message === 'string' ? chatJson.message : '',
    analysisId: typeof chatJson.analysis_id === 'string' ? chatJson.analysis_id : '',
    action: typeof chatJson.action === 'string' ? chatJson.action : 'answer_only',
  };
}

export function statusToLabel(status: MultimodalStatus): string {
  switch (status) {
    case 'compressing':
      return 'Preparing photos';
    case 'uploading':
      return 'Uploading photos';
    case 'reviewing':
      return 'Reviewing your home information';
    case 'preparing':
      return 'Preparing the response';
  }
}
