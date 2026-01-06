export type VideoProvider = 'youtube' | 'vimeo' | 'other';

export interface ParsedVideo {
  provider: VideoProvider;
  videoId: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}

const YOUTUBE_REGEX = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
const VIMEO_REGEX = /(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/;

export function parseVideoUrl(url: string): ParsedVideo | null {
  if (!url || typeof url !== 'string') return null;
  
  const trimmedUrl = url.trim();
  
  const youtubeMatch = trimmedUrl.match(YOUTUBE_REGEX);
  if (youtubeMatch) {
    const videoId = youtubeMatch[1];
    return {
      provider: 'youtube',
      videoId,
      embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    };
  }
  
  const vimeoMatch = trimmedUrl.match(VIMEO_REGEX);
  if (vimeoMatch) {
    const videoId = vimeoMatch[1];
    return {
      provider: 'vimeo',
      videoId,
      embedUrl: `https://player.vimeo.com/video/${videoId}?playsinline=1`,
      thumbnailUrl: null,
    };
  }
  
  return null;
}

export function isValidVideoUrl(url: string): boolean {
  return parseVideoUrl(url) !== null;
}

export function getProviderDisplayName(provider: VideoProvider): string {
  switch (provider) {
    case 'youtube': return 'YouTube';
    case 'vimeo': return 'Vimeo';
    default: return 'Video';
  }
}
