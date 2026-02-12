'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Video, Plus, Play, Trash2, Loader2, ExternalLink, AlertCircle, Check } from 'lucide-react';
import { useSafeCurrentContext } from '@/contexts/CurrentContext';
import { getSchemeId } from '@/lib/archive-scope';
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
  development_id?: string;
}

interface GroupedVideo {
  key: string;
  video: VideoResource;
  ids: string[];
  developmentIds: string[];
}

interface Development {
  id: string;
  name: string;
}

interface AddVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoAdded: () => void;
  developmentId: string;
  allDevelopments: Development[];
}

function AddVideoModal({ isOpen, onClose, onVideoAdded, developmentId, allDevelopments }: AddVideoModalProps) {
  const [videoUrl, setVideoUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ thumbnailUrl: string | null; provider: string } | null>(null);
  const [addToAll, setAddToAll] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setVideoUrl('');
      setTitle('');
      setDescription('');
      setError(null);
      setPreview(null);
      setAddToAll(false);
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
      const payload: Record<string, any> = {
        videoUrl,
        title,
        description,
      };

      if (addToAll && allDevelopments.length > 0) {
        payload.developmentIds = allDevelopments.map(d => d.id);
      } else {
        payload.developmentId = developmentId;
      }

      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add Video</h2>
          <p className="text-gray-500 text-sm mt-1">Paste a YouTube or Vimeo link</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Video URL</label>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              required
            />
          </div>
          
          {preview && preview.thumbnailUrl && (
            <div className="relative aspect-video rounded-xl overflow-hidden bg-gray-100">
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
            <label className="block text-sm font-medium text-gray-900 mb-2">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Home Walkthrough Video"
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the video..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-300 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-500 focus:border-transparent resize-none"
            />
          </div>

          {allDevelopments.length > 1 && (
            <div
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                addToAll
                  ? 'bg-gold-50 border-gold-300'
                  : 'bg-gray-50 border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setAddToAll(!addToAll)}
            >
              <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                addToAll ? 'bg-gold-500' : 'border-2 border-gray-300'
              }`}>
                {addToAll && <Check className="w-3.5 h-3.5 text-white" />}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Add to all developments</p>
                <p className="text-xs text-gray-500">
                  This video will be added to all {allDevelopments.length} developments
                </p>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors"
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
              ) : addToAll ? (
                `Add to All (${allDevelopments.length})`
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

function getEmbedUrl(video: VideoResource): string {
  // Regenerate embed URL from video_url to handle stale DB entries
  if (video.video_url) {
    const ytMatch = video.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) {
      return `https://www.youtube-nocookie.com/embed/${ytMatch[1]}?playsinline=1&rel=0&enablejsapi=1&autoplay=1`;
    }
    const vimeoMatch = video.video_url.match(/(?:vimeo\.com\/(?:video\/)?|player\.vimeo\.com\/video\/)(\d+)/);
    if (vimeoMatch) {
      return `https://player.vimeo.com/video/${vimeoMatch[1]}?playsinline=1&autoplay=1`;
    }
  }
  // Fallback: fix old youtube.com embed URLs to use youtube-nocookie.com
  if (video.embed_url?.includes('youtube.com/embed/')) {
    return video.embed_url.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
  }
  return video.embed_url;
}

function VideoPlayerModal({ video, onClose }: VideoPlayerModalProps) {
  if (!video) return null;

  const embedUrl = getEmbedUrl(video);

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
            src={embedUrl}
            title={video.title}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold text-white">{video.title}</h3>
            {video.description && (
              <p className="text-gray-300 mt-1">{video.description}</p>
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
}

export function VideosTab() {
  const { tenantId, archiveScope } = useSafeCurrentContext();
  const developmentId = getSchemeId(archiveScope);
  
  const [videos, setVideos] = useState<VideoResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoResource | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [hasTrackedView, setHasTrackedView] = useState(false);
  const [allDevelopments, setAllDevelopments] = useState<Development[]>([]);

  useEffect(() => {
    if (developmentId && !hasTrackedView) {
      trackVideoEvent('video_tab_opened', { developmentId });
      setHasTrackedView(true);
    }
  }, [developmentId, hasTrackedView]);

  useEffect(() => {
    async function loadDevelopments() {
      try {
        const response = await fetch('/api/developer/developments');
        if (response.ok) {
          const data = await response.json();
          setAllDevelopments(data.developments || []);
        }
      } catch (error) {
        console.error('[Videos] Failed to load developments:', error);
      }
    }
    loadDevelopments();
  }, []);

  const loadVideos = useCallback(async () => {
    setIsLoading(true);
    try {
      const url = developmentId
        ? `/api/videos?developmentId=${developmentId}`
        : `/api/videos?all=true`;
      const response = await fetch(url);
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

  const devNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    allDevelopments.forEach(d => { map[d.id] = d.name; });
    return map;
  }, [allDevelopments]);

  const groupedVideos: GroupedVideo[] = useMemo(() => {
    if (developmentId) {
      return videos.map(v => ({ key: v.id, video: v, ids: [v.id], developmentIds: v.development_id ? [v.development_id] : [] }));
    }
    const groups: Record<string, GroupedVideo> = {};
    for (const v of videos) {
      const groupKey = v.video_url;
      if (!groups[groupKey]) {
        groups[groupKey] = { key: groupKey, video: v, ids: [v.id], developmentIds: v.development_id ? [v.development_id] : [] };
      } else {
        groups[groupKey].ids.push(v.id);
        if (v.development_id && !groups[groupKey].developmentIds.includes(v.development_id)) {
          groups[groupKey].developmentIds.push(v.development_id);
        }
      }
    }
    return Object.values(groups);
  }, [videos, developmentId]);

  const handleDeleteGrouped = async (group: GroupedVideo) => {
    const count = group.ids.length;
    const msg = count > 1
      ? `This video is on ${count} schemes. Remove from all?`
      : 'Are you sure you want to remove this video?';
    if (!confirm(msg)) return;

    setDeletingId(group.key);
    try {
      await Promise.all(group.ids.map(id => fetch(`/api/videos?id=${id}`, { method: 'DELETE' })));
      setVideos(prev => prev.filter(v => !group.ids.includes(v.id)));
    } catch (error) {
      console.error('[Videos] Failed to delete video:', error);
    } finally {
      setDeletingId(null);
    }
  };

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
          <h2 className="text-xl font-semibold text-gray-900">Videos</h2>
          <p className="text-gray-900 text-sm mt-1">
            {groupedVideos.length} video{groupedVideos.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
        >
          <Plus className="w-5 h-5" />
          <span>Add Video</span>
        </button>
      </div>

      {groupedVideos.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
          <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Videos Yet</h3>
          <p className="text-gray-900 mb-6">Add YouTube or Vimeo videos for homeowners to watch.</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-100 text-gray-900 hover:bg-gray-200 transition-colors"
          >
            <Plus className="w-5 h-5" />
            <span>Add Your First Video</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {groupedVideos.map((group) => (
            <div
              key={group.key}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:border-gray-300 hover:shadow-md transition-all group"
            >
              <div 
                className="relative aspect-video bg-gray-100 cursor-pointer"
                onClick={() => handleVideoClick(group.video)}
              >
                {group.video.thumbnail_url ? (
                  <img
                    src={group.video.thumbnail_url}
                    alt={group.video.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center">
                    <Play className="w-8 h-8 text-black ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs text-white">
                  {getProviderDisplayName(group.video.provider)}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-medium text-gray-900 line-clamp-1">{group.video.title}</h3>
                {group.video.description && (
                  <p className="text-gray-900 text-sm mt-1 line-clamp-2">{group.video.description}</p>
                )}
                {!developmentId && group.developmentIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {group.developmentIds.map(devId => (
                      <span
                        key={devId}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-900 border border-gray-200"
                      >
                        {devNameMap[devId] || devId.slice(0, 8)}
                      </span>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3">
                  <a
                    href={group.video.video_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-900 hover:text-black transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteGrouped(group)}
                    disabled={deletingId === group.key}
                    className="text-gray-900 hover:text-red-500 transition-colors disabled:opacity-50"
                  >
                    {deletingId === group.key ? (
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

      <AddVideoModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onVideoAdded={loadVideos}
        developmentId={developmentId || (allDevelopments.length > 0 ? allDevelopments[0].id : '')}
        allDevelopments={allDevelopments}
      />

      <VideoPlayerModal
        video={selectedVideo}
        onClose={() => setSelectedVideo(null)}
      />
    </div>
  );
}
