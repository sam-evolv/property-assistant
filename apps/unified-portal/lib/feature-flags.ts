export function isVideosFeatureEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';
  }
  return process.env.FEATURE_VIDEOS === 'true' || process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';
}

export function isPurchaserVideosFeatureEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_FEATURE_VIDEOS_PURCHASER === 'true' || process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';
  }
  return process.env.FEATURE_VIDEOS_PURCHASER === 'true' || process.env.FEATURE_VIDEOS === 'true';
}

export function isAssistantOSEnabled(): boolean {
  if (process.env.FEATURE_ASSISTANT_OS === 'false') {
    return false;
  }
  return true;
}

/**
 * Assistant V2 image upload (Sprint 1).
 *
 * Default off. When false:
 *   - the homeowner chat input does not render the attachment button
 *   - the three new server routes under /api/assistant/* return 404
 *
 * Server reads FEATURE_ASSISTANT_IMAGE_UPLOAD. Client reads
 * NEXT_PUBLIC_FEATURE_ASSISTANT_IMAGE_UPLOAD (must be set separately
 * for the bundler to inline the value).
 */
export function isAssistantImageUploadEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_FEATURE_ASSISTANT_IMAGE_UPLOAD === 'true';
  }
  return (
    process.env.FEATURE_ASSISTANT_IMAGE_UPLOAD === 'true' ||
    process.env.NEXT_PUBLIC_FEATURE_ASSISTANT_IMAGE_UPLOAD === 'true'
  );
}

/**
 * Assistant V2 builder-side snag app (Sprint 2).
 *
 * Default off. When false:
 *   - the /snag and /admin/snaggers routes render as 404 (Session 3)
 *   - all /api/snag/* server routes return 404 before any auth or DB work
 *
 * Server reads FEATURE_BUILDER_SNAG_APP. Client reads
 * NEXT_PUBLIC_FEATURE_BUILDER_SNAG_APP (must be set separately for the
 * bundler to inline the value at build time).
 */
export function isBuilderSnagAppEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_FEATURE_BUILDER_SNAG_APP === 'true';
  }
  return (
    process.env.FEATURE_BUILDER_SNAG_APP === 'true' ||
    process.env.NEXT_PUBLIC_FEATURE_BUILDER_SNAG_APP === 'true'
  );
}

export function getFeatureFlags() {
  return {
    videos: isVideosFeatureEnabled(),
    purchaserVideos: isPurchaserVideosFeatureEnabled(),
    assistantOS: isAssistantOSEnabled(),
    assistantImageUpload: isAssistantImageUploadEnabled(),
    builderSnagApp: isBuilderSnagAppEnabled(),
  };
}
