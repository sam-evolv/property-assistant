/**
 * Shared type for media attachments rendered in chat history.
 *
 * Lives in its own file so the Message interface in PurchaserChatTab.tsx
 * and the thumbnail / lightbox components can import the same shape
 * without dragging client-side React deps into the chat tab module
 * boundary.
 */
export interface ChatMediaAttachment {
  /** assistant_media.id */
  id: string;
  /** One hour signed URL for the original */
  signed_url: string;
  /** One hour signed URL for the thumbnail (falls back to the original) */
  thumbnail_url: string;
}
