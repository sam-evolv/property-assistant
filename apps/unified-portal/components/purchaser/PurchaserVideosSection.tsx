'use client';

import { useState, useEffect, useCallback } from 'react';
import { Video, Play, X, Loader2, ExternalLink } from 'lucide-react';

interface VideoResource {
  id: string;
  title: string;
  description?: string;
  provider: string;
  embed_url: string;
  thumbnail_url?: string;
}

interface PurchaserVideosSectionProps {
  unitUid: string;
  isDarkMode: boolean;
}

export default function PurchaserVideosSection({ unitUid, isDarkMode }: PurchaserVideosSectionProps) {
  const [videos, setVideos] = useState<VideoResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<VideoResource | null>(null);
  const [embedError, setEmbedError] = useState(false);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const storedToken = sessionStorage.getItem(`house_token_${unitUid}`);
        const token = storedToken || unitUid;

        const res = await fetch(
          `/api/purchaser/videos?unitUid=${unitUid}&token=${encodeURIComponent(token)}`
        );

        if (!res.ok) {
          if (res.status === 404) {
            setVideos([]);
            return;
          }
          throw new Error('Failed to load videos');
        }

        const data = await res.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error('[PurchaserVideosSection] Error:', err);
        setError('Unable to load videos');
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, [unitUid]);

  const closeModal = useCallback(() => {
    setPlayingVideo(null);
    setEmbedError(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && playingVideo) {
        closeModal();
      }
    };

    if (playingVideo) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [playingVideo, closeModal]);

  const getProviderBadge = (provider: string) => {
    const providerLower = provider.toLowerCase();
    if (providerLower === 'youtube') {
      return { label: 'YouTube', color: 'bg-red-600' };
    } else if (providerLower === 'vimeo') {
      return { label: 'Vimeo', color: 'bg-blue-500' };
    }
    return { label: provider, color: 'bg-gray-600' };
  };

  const getOriginalUrl = (video: VideoResource) => {
    const embedUrl = video.embed_url;
    if (embedUrl.includes('youtube.com/embed/')) {
      const videoId = embedUrl.split('/embed/')[1]?.split('?')[0];
      return `https://www.youtube.com/watch?v=${videoId}`;
    } else if (embedUrl.includes('player.vimeo.com/video/')) {
      const videoId = embedUrl.split('/video/')[1]?.split('?')[0];
      return `https://vimeo.com/${videoId}`;
    }
    return embedUrl;
  };

  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-3">
          <div className={`w-32 h-5 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`} />
          <div className={`w-6 h-5 rounded-full ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`} />
        </div>
        <div className={`w-64 h-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse mb-4`} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className={`rounded-lg overflow-hidden ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
              <div className={`aspect-video ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`} />
              <div className="p-3">
                <div className={`w-3/4 h-4 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse mb-2`} />
                <div className={`w-1/2 h-3 rounded ${isDarkMode ? 'bg-gray-700' : 'bg-gray-200'} animate-pulse`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error || videos.length === 0) {
    return null;
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-gold-500" />
            <h3 className={`text-base font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              Handover Videos
            </h3>
          </div>
          <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${isDarkMode ? 'bg-gold-500/20 text-gold-400' : 'bg-gold-100 text-gold-700'}`}>
            {videos.length}
          </span>
        </div>
        <p className={`text-sm mb-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          Short walkthroughs that help you use your home systems correctly.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {videos.map((video) => {
            const badge = getProviderBadge(video.provider);
            return (
              <div
                key={video.id}
                className={`group rounded-lg overflow-hidden border transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 cursor-pointer ${
                  isDarkMode 
                    ? 'bg-gray-800 border-gray-700 hover:border-gold-500/50' 
                    : 'bg-white border-gray-200 hover:border-gold-400'
                }`}
                onClick={() => {
                  console.log('[Videos Analytics] video_started', { videoId: video.id, provider: video.provider });
                  setPlayingVideo(video);
                  setEmbedError(false);
                }}
              >
                <div className="relative aspect-video overflow-hidden">
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <Video className={`w-12 h-12 ${isDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                    </div>
                  )}
                  
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-gold-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 transform scale-75 group-hover:scale-100 shadow-lg">
                      <Play className="w-7 h-7 text-black fill-black ml-1" />
                    </div>
                  </div>

                  <div className={`absolute top-2 right-2 px-2 py-0.5 text-xs font-medium rounded ${badge.color} text-white`}>
                    {badge.label}
                  </div>
                </div>

                <div className="p-3">
                  <h4 className={`font-medium text-sm line-clamp-1 mb-1 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    {video.title}
                  </h4>
                  {video.description && (
                    <p className={`text-xs line-clamp-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                      {video.description}
                    </p>
                  )}
                  <button
                    className="mt-2 text-xs font-medium text-gold-500 hover:text-gold-400 transition-colors flex items-center gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('[Videos Analytics] video_started', { videoId: video.id, provider: video.provider });
                      setPlayingVideo(video);
                      setEmbedError(false);
                    }}
                  >
                    <Play className="w-3 h-3" />
                    Watch
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {playingVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="video-modal-title"
        >
          <div
            className="relative w-full max-w-[900px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeModal}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gold-500 transition-colors rounded-lg hover:bg-white/10"
              aria-label="Close video"
            >
              <X className="w-6 h-6" />
            </button>

            {!embedError ? (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-black shadow-2xl">
                <iframe
                  src={playingVideo.embed_url}
                  title={playingVideo.title}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  onError={() => setEmbedError(true)}
                />
              </div>
            ) : (
              <div className="aspect-video w-full rounded-lg overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-6 text-center">
                <Video className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-white text-lg font-medium mb-2">Unable to load video</p>
                <p className="text-gray-400 text-sm mb-4">The video embed could not be loaded in this viewer.</p>
                <a
                  href={getOriginalUrl(playingVideo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gold-500 text-black font-medium rounded-lg hover:bg-gold-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Open in Browser
                </a>
              </div>
            )}

            <div className="mt-4 max-w-[900px]">
              <h3 id="video-modal-title" className="text-white text-lg font-semibold">
                {playingVideo.title}
              </h3>
              {playingVideo.description && (
                <p className="text-gray-400 text-sm mt-2 line-clamp-3">
                  {playingVideo.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3">
                <span className={`px-2 py-0.5 text-xs font-medium rounded ${getProviderBadge(playingVideo.provider).color} text-white`}>
                  {getProviderBadge(playingVideo.provider).label}
                </span>
                <a
                  href={getOriginalUrl(playingVideo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-gray-400 hover:text-gold-500 transition-colors flex items-center gap-1"
                >
                  <ExternalLink className="w-3 h-3" />
                  Open in new tab
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
