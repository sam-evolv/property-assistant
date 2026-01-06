'use client';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Video, Plus, Play, Trash2, Loader2, ExternalLink, AlertCircle } from 'lucide-react';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { getSchemeId, isAllSchemes } from '@/lib/archive-scope';
import { getProviderDisplayName } from '@/lib/video-parser';

interface VideoResource {
  id: string;
  provider: 'youtube' | 'vimeo' | 'other';
  video_url: string;
  embed_url: string;
  video_id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  created_at: string;
}

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoAdded: () => void;
  developmentId: string;
}

function AddVideoModal({ isOpen, onClose, onVideoAdded, developmentId }: AddVideoModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ thumbnailUrl: string | null; provider: string } | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setVideoUrl('');
      setTitle('');
      setDescription('');
      setError(null);
      setPreview(null);
    }
  }, [isOpen]);

  useEffect(() => {
    const checkUrl = async () => {
      if (!videoUrl.trim()) {
        setPreview(null);
        return;
      }
      
      try {
        const { parseVideoUrl } = await import('@/lib/video-parser');
        const parsed = parseVideoUrl(videoUrl);
        if (parsed) {
          setPreview({ thumbnailUrl: parsed.thumbnailUrl, provider: parsed.provider });
          setError(null);
        } else {
          setPreview(null);
          if (videoUrl.length > 10) {
            setError('Only YouTube and Vimeo links are supported');
          }
        }
      } catch {
        setPreview(null);
      }
    };
    
    const timer = setTimeout(checkUrl, 300);
    return () => clearTimeout(timer);
  }, [videoUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoUrl || !title || !preview) return;
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          developmentId,
          videoUrl,
          title,
          description,
        }),
      });
      
      if (response.ok) {
        onVideoAdded();
        onClose();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add video');
      }
    } catch {
      setError('Failed to add video');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-gray-900 rounded-2xl border border-gray-700 w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b border-gray-800">
          <h2 className="text-xl font-semibold text-white">Add Video</h2>
          <p className="text-gray-400 text-sm mt-1">Paste a YouTube or Vimeo link</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Video URL</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              required
            />
          </div>
          
          {preview && preview.thumbnailUrl && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-800">
              <img
                src={preview.thumbnailUrl}
                alt="Video preview"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                {getProviderDisplayName(preview.provider as 'youtube' | 'vimeo' | 'other')}
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Home Walkthrough Video"
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the video..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent resize-none"
            />
          </div>
          
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !preview || !title}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                'Add Video'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface VideoPlayerModalProps {
  video: VideoResource | null;
  onClose: () => void;
}

function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  if (!video) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-4xl mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video rounded-xl overflow-hidden bg-black">
          <iframe
            src={video.embed_url}
            title={video.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">{video.title}</h3>
            {video.description && (
              <p className="text-gray-400 mt-1">{video.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function trackVideoEvent(eventType: string, data: Record<string, any>) {
  if (typeof window === 'undefined') return;
  console.log(`[Videos Analytics] ${eventType}`, data);
  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eventType, ...data }),
  }).catch(() => {});
}

export function VideosTab() {
  const { tenantId, archiveScope } = useSafeCurrentContext();
  const developmentId = getSchemeId(archiveScope);
  const isViewingAllSchemes = isAllSchemes(archiveScope);
  
  const [videos, setVideos] = useState<VideoResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoResource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);

  useEffect(() => {
    if (developmentId && !hasTrackedView) {
      trackVideoEvent('video_tab_opened', { developmentId });
      setHasTrackedView(true);
    }
  }, [developmentId, hasTrackedView]);

  const loadVideos = useCallback(async () => {
    if (!developmentId) {
      setVideos([]);
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/videos?developmentId=${developmentId}`);
      if (response.ok) {
        const data = await response.json();
        setVideos(data.videos || []);
      }
    } catch (error) {
      console.error('[Videos] Failed to load videos:', error);
    } finally {
      setIsLoading(false);
    }
  }, [developmentId]);

  useEffect(() => {
    loadVideos();
  }, [loadVideos]);

  const handleDelete = async (videoId: string) => {
    if (!confirm('Are you sure you want to remove this video?')) return;
    
    setDeletingId(videoId);
    try {
      const response = await fetch(`/api/videos?id=${videoId}`, { method: 'DELETE' });
      if (response.ok) {
        setVideos(prev => prev.filter(v => v.id !== videoId));
      }
    } catch (error) {
      console.error('[Videos] Failed to delete video:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleVideoClick = (video: VideoResource) => {
    trackVideoEvent('video_started', { 
      developmentId, 
      videoId: video.id, 
      provider: video.provider,
      title: video.title 
    });
    setSelectedVideo(video);
  };

  if (isViewingAllSchemes) {
    return (
      <div className="text-center py-16">
        <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-300 mb-2">Select a Scheme</h3>
        <p className="text-gray-500">Videos are organised per scheme. Select a scheme to view its videos.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-gold-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-white">Videos</h2>
          <p className="text-gray-400 text-sm mt-1">
            {videos.length} video{videos.length !== 1 ? 's' : ''} available
          </p>
        </div>
        {developmentId && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
          >
            <Plus className="w-5 h-5" />
            <span>Add Video</span>
          </button>
        )}
      </div>

      {videos.length === 0 ? (
        <div className="text-center py-16 bg-gray-900/50 rounded-2xl border border-gray-800">
          <Video className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-300 mb-2">No Videos Yet</h3>
          <p className="text-gray-500 mb-6">Add YouTube or Vimeo videos for homeowners to watch.</p>
          {developmentId && (
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              <span>Add Your First Video</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {videos.map((video) => (
            <div
              key={video.id}
              className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden hover:border-gray-700 transition-colors group"
            >
              <div 
                className="relative aspect-video bg-gray-800 cursor-pointer"
                onClick={() => handleVideoClick(video)}
              >
                {video.thumbnail_url ? (
                  <img
                    src={video.thumbnail_url}
                    alt={video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-600" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                  {getProviderDisplayName(video.provider)}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-white line-clamp-1">{video.title}</h3>
                {video.description && (
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">{video.description}</p>
                )}
                <div className="flex items-center justify-between mt-3">
                  <a
                    href={video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(video.id)}
                    disabled={deletingId === video.id}
                    className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                  >
                    {deletingId === video.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {developmentId && (
        <AddVideoModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          onVideoAdded={loadVideos}
          developmentId={developmentId}
        />
      )}

      <VideoPlayerModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
}
