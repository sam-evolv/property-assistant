'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Camera, Plus, Eye, EyeOff, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { colors, EASE, STAGE_LABELS, BUILD_STAGES } from '@/components/select/builder/tokens';

// ---- Types ------------------------------------------------------------------

interface Photo {
  id: string;
  project_id: string;
  url: string;
  filename: string;
  stage: string | null;
  caption: string | null;
  visibility: 'private' | 'shared';
  created_at: string;
}

interface PhotosTabProps {
  projectId: string;
}

// ---- Transition helper ------------------------------------------------------

const transition = `all 200ms ${EASE}`;

// ---- Component --------------------------------------------------------------

export default function PhotosTab({ projectId }: PhotosTabProps) {
  const supabase = createClientComponentClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState<string>('all');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  // ---- Fetch photos ---------------------------------------------------------

  const fetchPhotos = useCallback(async () => {
    const { data, error } = await supabase
      .from('select_project_photos')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setPhotos(data as Photo[]);
    }
    setLoading(false);
  }, [projectId, supabase]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  // ---- Filtered photos ------------------------------------------------------

  const filteredPhotos =
    activeStage === 'all'
      ? photos
      : photos.filter((p) => p.stage === activeStage);

  // ---- Lightbox navigation --------------------------------------------------

  const lightboxPhoto =
    lightboxIndex !== null ? filteredPhotos[lightboxIndex] : null;

  function openLightbox(index: number) {
    setLightboxIndex(index);
  }

  function closeLightbox() {
    setLightboxIndex(null);
  }

  function prevPhoto() {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex === 0 ? filteredPhotos.length - 1 : lightboxIndex - 1,
    );
  }

  function nextPhoto() {
    if (lightboxIndex === null) return;
    setLightboxIndex(
      lightboxIndex === filteredPhotos.length - 1 ? 0 : lightboxIndex + 1,
    );
  }

  // ---- Toggle visibility ----------------------------------------------------

  async function toggleVisibility(photo: Photo, newVisibility: 'private' | 'shared') {
    if (photo.visibility === newVisibility) return;

    const { error } = await supabase
      .from('select_project_photos')
      .update({ visibility: newVisibility })
      .eq('id', photo.id);

    if (!error) {
      setPhotos((prev) =>
        prev.map((p) => (p.id === photo.id ? { ...p, visibility: newVisibility } : p)),
      );
    }
  }

  // ---- Upload ---------------------------------------------------------------

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = `${projectId}/${Date.now()}_${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('project-photos')
        .upload(filePath, file);

      if (uploadError) continue;

      const { data: urlData } = supabase.storage
        .from('project-photos')
        .getPublicUrl(filePath);

      if (urlData?.publicUrl) {
        await supabase.from('select_project_photos').insert({
          project_id: projectId,
          url: urlData.publicUrl,
          filename: file.name,
          visibility: 'private',
        });
      }
    }

    setUploading(false);
    fetchPhotos();
  }

  // ---- Stage filter pills ---------------------------------------------------

  const stageFilters: { key: string; label: string }[] = [
    { key: 'all', label: 'All' },
    ...BUILD_STAGES.map((s) => ({ key: s, label: STAGE_LABELS[s] || s })),
  ];

  // ---- Render ---------------------------------------------------------------

  return (
    <div style={{ position: 'relative', minHeight: 300 }}>
      {/* Stage filter pills */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          paddingBottom: 16,
          marginBottom: 16,
          scrollbarWidth: 'none',
        }}
      >
        {stageFilters.map((sf) => {
          const isActive = activeStage === sf.key;
          return (
            <button
              key={sf.key}
              onClick={() => setActiveStage(sf.key)}
              style={{
                flexShrink: 0,
                padding: '6px 12px',
                borderRadius: 16,
                fontSize: 12,
                fontWeight: 500,
                lineHeight: '1.4',
                background: isActive ? colors.goldGlow : colors.surface2,
                border: `1px solid ${isActive ? colors.gold : colors.border}`,
                color: isActive ? colors.gold : colors.textSecondary,
                cursor: 'pointer',
                transition,
                whiteSpace: 'nowrap',
              }}
            >
              {sf.label}
            </button>
          );
        })}
      </div>

      {/* Loading state */}
      {loading && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 64,
            color: colors.textMuted,
            fontSize: 14,
          }}
        >
          Loading photos...
        </div>
      )}

      {/* Empty state */}
      {!loading && filteredPhotos.length === 0 && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 64,
            gap: 12,
            color: colors.textMuted,
          }}
        >
          <Camera size={40} strokeWidth={1.5} />
          <span style={{ fontSize: 14 }}>
            {activeStage === 'all'
              ? 'No photos yet. Tap + to upload.'
              : `No photos for ${STAGE_LABELS[activeStage] || activeStage}.`}
          </span>
        </div>
      )}

      {/* Photo grid */}
      {!loading && filteredPhotos.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: 12,
          }}
        >
          {filteredPhotos.map((photo, index) => {
            const isHovered = hoveredCard === photo.id;
            return (
              <div
                key={photo.id}
                style={{
                  position: 'relative',
                  borderRadius: 10,
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition,
                  transform: isHovered ? 'scale(1.02)' : 'scale(1)',
                }}
                onMouseEnter={() => setHoveredCard(photo.id)}
                onMouseLeave={() => setHoveredCard(null)}
                onClick={() => openLightbox(index)}
              >
                <img
                  src={photo.url}
                  alt={photo.caption || photo.filename}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    display: 'block',
                    borderRadius: 10,
                  }}
                />

                {/* Hover overlay */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '24px 10px 10px',
                    background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    opacity: isHovered ? 1 : 0,
                    transition,
                    pointerEvents: 'none',
                  }}
                >
                  {/* Stage tag */}
                  {photo.stage && (
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color: colors.textPrimary,
                        background: 'rgba(0,0,0,0.5)',
                        padding: '2px 8px',
                        borderRadius: 8,
                      }}
                    >
                      {STAGE_LABELS[photo.stage] || photo.stage}
                    </span>
                  )}

                  {/* Visibility badge */}
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      padding: '2px 8px',
                      borderRadius: 8,
                      color:
                        photo.visibility === 'shared'
                          ? colors.green
                          : colors.textMuted,
                      background: 'rgba(0,0,0,0.5)',
                    }}
                  >
                    {photo.visibility === 'shared' ? 'Shared' : 'Private'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            background: 'rgba(0,0,0,0.9)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={closeLightbox}
        >
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              closeLightbox();
            }}
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              background: 'rgba(255,255,255,0.1)',
              border: 'none',
              borderRadius: '50%',
              width: 40,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: colors.textPrimary,
              transition,
              zIndex: 10,
            }}
          >
            <X size={20} />
          </button>

          {/* Prev button */}
          {filteredPhotos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                prevPhoto();
              }}
              style={{
                position: 'absolute',
                left: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: colors.textPrimary,
                transition,
                zIndex: 10,
              }}
            >
              <ChevronLeft size={22} />
            </button>
          )}

          {/* Next button */}
          {filteredPhotos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                nextPhoto();
              }}
              style={{
                position: 'absolute',
                right: 16,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'rgba(255,255,255,0.1)',
                border: 'none',
                borderRadius: '50%',
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: colors.textPrimary,
                transition,
                zIndex: 10,
              }}
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* Image + meta */}
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 16,
              maxWidth: '90vw',
            }}
          >
            <img
              src={lightboxPhoto.url}
              alt={lightboxPhoto.caption || lightboxPhoto.filename}
              style={{
                maxHeight: '80vh',
                maxWidth: '90vw',
                objectFit: 'contain',
                borderRadius: 8,
              }}
            />

            {/* Caption, date, stage */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {lightboxPhoto.caption && (
                <span
                  style={{
                    color: colors.textPrimary,
                    fontSize: 15,
                    fontWeight: 500,
                  }}
                >
                  {lightboxPhoto.caption}
                </span>
              )}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: colors.textMuted,
                  fontSize: 13,
                }}
              >
                <span>
                  {new Date(lightboxPhoto.created_at).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                {lightboxPhoto.stage && (
                  <>
                    <span style={{ opacity: 0.4 }}>|</span>
                    <span>{STAGE_LABELS[lightboxPhoto.stage] || lightboxPhoto.stage}</span>
                  </>
                )}
              </div>
            </div>

            {/* Visibility toggle */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                onClick={() => toggleVisibility(lightboxPhoto, 'private')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition,
                  border:
                    lightboxPhoto.visibility === 'private'
                      ? `1px solid ${colors.textMuted}`
                      : `1px solid ${colors.border}`,
                  background:
                    lightboxPhoto.visibility === 'private'
                      ? colors.surface3
                      : 'transparent',
                  color:
                    lightboxPhoto.visibility === 'private'
                      ? colors.textPrimary
                      : colors.textMuted,
                }}
              >
                <EyeOff size={14} />
                Private
              </button>

              <button
                onClick={() => toggleVisibility(lightboxPhoto, 'shared')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'pointer',
                  transition,
                  border:
                    lightboxPhoto.visibility === 'shared'
                      ? `1px solid ${colors.green}`
                      : `1px solid ${colors.border}`,
                  background:
                    lightboxPhoto.visibility === 'shared'
                      ? 'rgba(16,185,129,0.1)'
                      : 'transparent',
                  color:
                    lightboxPhoto.visibility === 'shared'
                      ? colors.green
                      : colors.textMuted,
                }}
              >
                <Eye size={14} />
                Shared with homeowner
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload FAB */}
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: uploading ? colors.surface3 : colors.gold,
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: uploading ? 'wait' : 'pointer',
          boxShadow: `0 4px 20px rgba(212, 175, 55, 0.3)`,
          transition,
          zIndex: 100,
        }}
      >
        <Plus
          size={24}
          style={{
            color: uploading ? colors.textMuted : colors.bg,
            animation: uploading ? 'spin 1s linear infinite' : 'none',
          }}
        />
      </button>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => handleUpload(e.target.files)}
      />
    </div>
  );
}
