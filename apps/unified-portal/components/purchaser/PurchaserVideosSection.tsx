'use client';

import { useState, useEffect } from 'react';
import { Video, Play, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

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
  const [expanded, setExpanded] = useState(true);
  const [playingVideo, setPlayingVideo] = useState<VideoResource | null>(null);

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

  if (loading) {
    return (
      <div className={`p-4 rounded-xl mb-4 ${isDarkMode ? 'bg-grey-900' : 'bg-grey-100'}`}>
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-gold-500" />
          <span className={`text-sm ${isDarkMode ? 'text-grey-400' : 'text-grey-600'}`}>
            Loading videos...
          </span>
        </div>
      </div>
    );
  }

  if (error || videos.length === 0) {
    return null;
  }

  return (
    <>
      <div className={`rounded-xl mb-4 overflow-hidden ${isDarkMode ? 'bg-grey-900' : 'bg-grey-100'}`}>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`w-full px-4 py-3 flex items-center justify-between ${isDarkMode ? 'hover:bg-grey-800' : 'hover:bg-grey-200'} transition-colors`}
        >
          <div className="flex items-center gap-2">
            <Video className="w-5 h-5 text-gold-500" />
            <span className={`font-medium ${isDarkMode ? 'text-white' : 'text-grey-900'}`}>
              Videos ({videos.length})
            </span>
          </div>
          {expanded ? (
            <ChevronUp className={`w-5 h-5 ${isDarkMode ? 'text-grey-400' : 'text-grey-600'}`} />
          ) : (
            <ChevronDown className={`w-5 h-5 ${isDarkMode ? 'text-grey-400' : 'text-grey-600'}`} />
          )}
        </button>

        {expanded && (
          <div className="p-4 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {videos.map((video) => (
                <button
                  key={video.id}
                  onClick={() => {
                    console.log('[Videos Analytics] video_started', { videoId: video.id, provider: video.provider });
                    setPlayingVideo(video);
                  }}
                  className={`group relative aspect-video rounded-lg overflow-hidden ${isDarkMode ? 'bg-grey-800' : 'bg-grey-200'}`}
                >
                  {video.thumbnail_url ? (
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className={`w-8 h-8 ${isDarkMode ? 'text-grey-600' : 'text-grey-400'}`} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full bg-gold-500 flex items-center justify-center">
                      <Play className="w-6 h-6 text-black fill-black ml-1" />
                    </div>
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                    <p className="text-white text-xs font-medium truncate">{video.title}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {playingVideo && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPlayingVideo(null)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPlayingVideo(null)}
              className="absolute -top-12 right-0 p-2 text-white hover:text-gold-500 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-black">
              <iframe
                src={playingVideo.embed_url}
                title={playingVideo.title}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
            <div className="mt-4">
              <h3 className="text-white text-lg font-medium">{playingVideo.title}</h3>
              {playingVideo.description && (
                <p className="text-grey-400 text-sm mt-1">{playingVideo.description}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
