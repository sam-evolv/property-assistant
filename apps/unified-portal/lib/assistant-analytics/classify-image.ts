import type { AttachedMediaItem } from './types';

/**
 * Coarse image category for analytics (image_classification column).
 *
 * Placeholder: returns 'image' for every attachment. The point of this function
 * existing now is to give the route a stable hook so the column is populated
 * non-null and the wiring is in place.
 *
 * TODO: Wire real image classification via a separate GPT-4o call or cached
 * vision-model output. For now returns 'image' to populate the column non-null.
 */
export function classifyImage(_imageRef: { mime: string; size: number; width?: number; height?: number }): string {
  return 'image';
}

export type { AttachedMediaItem };
