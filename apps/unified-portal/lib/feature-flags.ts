export function isVideosFeatureEnabled(): boolean {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';
  }
  return process.env.FEATURE_VIDEOS === 'true' || process.env.NEXT_PUBLIC_FEATURE_VIDEOS === 'true';
}

export function getFeatureFlags() {
  return {
    videos: isVideosFeatureEnabled(),
  };
}
