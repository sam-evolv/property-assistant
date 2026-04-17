'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useCareApp } from '../care-app-provider';
import {
  Search,
  Play,
  FileText,
  Download,
  X,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';

/* ── Scroll Reveal Hook ── */
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { ref, visible };
}

function RevealSection({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const { ref, visible } = useScrollReveal(0.1);
  return (
    <div ref={ref}>
      <div
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: `opacity 550ms cubic-bezier(.16, 1, .3, 1) ${delay}ms, transform 550ms cubic-bezier(.16, 1, .3, 1) ${delay}ms`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Types ── */
type FilterChip = 'all' | 'solar' | 'heat_pump' | 'documents' | 'faq';

interface VideoItem {
  id: string;
  videoId: string | null;
  title: string;
  section: string;
  category: 'solar' | 'heat_pump';
  source: 'SolarEdge' | 'Mitsubishi' | 'Daikin';
  duration?: string;
  description?: string;
  sourceUrl?: string;
}

interface DocumentItem {
  id: string;
  title: string;
  subtitle: string;
}

interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

/* ── Verified SolarEdge video IDs (solaredge.com) ── */
const solarVideos: VideoItem[] = [
  {
    id: 'se-connect',
    videoId: 'wMaJxhl0vl8',
    title: 'Connect Your Inverter and Check Its Status',
    section: 'Solar: Getting Started',
    category: 'solar',
    source: 'SolarEdge',
  },
];

const heatPumpVideos: VideoItem[] = [
  {
    id: 'mits-overview',
    videoId: '6PlCbYRdbso',
    title: 'Mitsubishi Ecodan: Homeowner Overview',
    section: 'Heat Pump Guidance',
    category: 'heat_pump',
    source: 'Mitsubishi',
    description: 'An introduction to home heating with Ecodan air source heat pumps.',
    sourceUrl: 'https://les.mitsubishielectric.co.uk/homeowners/homeowner-welcome-pack/getstarted/homeowner-videos',
  },
  {
    id: 'mits-melcloud',
    videoId: 'vgFOeH2_WQw',
    title: 'Using the MELCloud App',
    section: 'Heat Pump Guidance',
    category: 'heat_pump',
    source: 'Mitsubishi',
    description: 'How to connect your Wi-Fi adapter and set up MELCloud for remote control and monitoring.',
    sourceUrl: 'https://les.mitsubishielectric.co.uk/homeowners/homeowner-welcome-pack/getstarted/homeowner-videos',
  },
  {
    id: 'mits-how-works',
    videoId: 'JQ1tRFqUgac',
    title: 'How a Heat Pump Works',
    section: 'Heat Pump Guidance',
    category: 'heat_pump',
    source: 'Mitsubishi',
    description: 'A quick explainer covering the heat exchanger, hot water system, and how energy is collected from outside air.',
    sourceUrl: 'https://les.mitsubishielectric.co.uk/homeowners/homeowner-welcome-pack/getstarted/homeowner-videos',
  },
];

const documents: DocumentItem[] = [
  { id: 'doc-1', title: 'SolarEdge SE3680H Manual', subtitle: 'PDF \u00B7 3.1 MB' },
  { id: 'doc-2', title: 'JA Solar 410W Datasheet', subtitle: 'PDF \u00B7 1.8 MB' },
  { id: 'doc-3', title: 'SolarEdge Home Battery Installation Guide', subtitle: 'PDF \u00B7 2.4 MB' },
  { id: 'doc-4', title: 'SEAI Grant Confirmation \u2014 SE-2026-0312', subtitle: 'PDF \u00B7 280 KB' },
  { id: 'doc-5', title: 'BER Certificate \u2014 12 Meadow Drive, Ballincollig', subtitle: 'PDF \u00B7 420 KB' },
  { id: 'doc-6', title: 'SE Systems Annual Service Guide', subtitle: 'PDF \u00B7 640 KB' },
];

const faqs: FaqItem[] = [
  {
    id: 'faq-1',
    question: 'When will I see my first generation data?',
    answer:
      'Your SolarEdge inverter begins reporting within minutes of commissioning. Live data appears in the mySolarEdge app once your inverter is connected to your home Wi-Fi.',
  },
  {
    id: 'faq-2',
    question: 'Does my system work during a power cut?',
    answer:
      'Standard grid-tied solar shuts down during a power cut for safety. If a battery backup gateway was installed, essential circuits continue to run on battery until grid power is restored.',
  },
  {
    id: 'faq-3',
    question: 'How do I maximise my self-consumption?',
    answer:
      'Run high-draw appliances (washing machine, dishwasher, EV charger) during daylight hours. The mySolarEdge app shows real-time production so you can time usage to free solar.',
  },
  {
    id: 'faq-4',
    question: 'When is my annual service due?',
    answer:
      'SE Systems schedules an annual health check roughly 12 months after install. Your next service date appears on the Home tab and you will receive an email reminder two weeks in advance.',
  },
  {
    id: 'faq-5',
    question: 'What is covered by my warranty?',
    answer:
      'Panels carry a 25-year product warranty, the inverter a 12-year warranty, and SE Systems provides a 10-year workmanship warranty on the installation itself.',
  },
];

/* ── Video Card ── */
function VideoCard({ video, onPlay }: { video: VideoItem; onPlay: (v: VideoItem) => void }) {
  const hasVideo = !!video.videoId;
  const thumbSrc = hasVideo
    ? `https://i.ytimg.com/vi/${video.videoId}/maxresdefault.jpg`
    : null;
  const thumbFallback = hasVideo
    ? `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`
    : null;

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => hasVideo && onPlay(video)}
        disabled={!hasVideo}
        className="group relative w-full overflow-hidden rounded-xl bg-gray-900 transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-default"
        style={{ aspectRatio: '16/9', WebkitTapHighlightColor: 'transparent' }}
        aria-label={hasVideo ? `Play ${video.title}` : `${video.title}`}
      >
        {thumbSrc ? (
          <img
            src={thumbSrc}
            onError={(e) => { if (thumbFallback) e.currentTarget.src = thumbFallback; }}
            alt={video.title}
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-800 to-gray-900 p-3 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-white/70">
              {video.source}
            </span>
          </div>
        )}

        {/* Source badge */}
        <div
          className="absolute left-2 top-2 rounded px-1.5 py-0.5"
          style={{ background: 'rgba(255,255,255,0.95)' }}
        >
          <span
            className="text-[10px] font-semibold uppercase text-gray-900"
            style={{ letterSpacing: '0.08em' }}
          >
            {video.source}
          </span>
        </div>

        {/* Duration badge */}
        {video.duration && (
          <div
            className="absolute right-2 top-2 rounded px-1.5 py-0.5"
            style={{ background: 'rgba(0,0,0,0.7)' }}
          >
            <span className="text-[11px] font-medium text-white">{video.duration}</span>
          </div>
        )}

        {/* Play overlay */}
        {hasVideo && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <Play className="h-5 w-5 ml-0.5" style={{ color: '#D4AF37' }} fill="#D4AF37" />
            </div>
          </div>
        )}
      </button>

      <p className="mt-2 text-[13px] font-medium leading-snug text-gray-900">{video.title}</p>
    </div>
  );
}

/* ── Video Modal ── */
function VideoModal({ video, onClose }: { video: VideoItem; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  if (!video.videoId) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-0 sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={video.title}
    >
      <div
        className="relative w-full h-full sm:h-auto sm:max-w-[900px]"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 sm:-top-12 sm:right-0 z-10 rounded-full bg-black/60 p-2 text-white transition-colors hover:bg-black/80 sm:bg-transparent sm:hover:bg-white/10"
          aria-label="Close video"
        >
          <X className="h-6 w-6" />
        </button>
        <div className="w-full bg-black sm:rounded-lg sm:overflow-hidden sm:shadow-2xl">
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0&modestbranding=1`}
              title={video.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
          <div className="px-4 py-3 sm:px-5 sm:py-4">
            <h3 className="text-base font-semibold text-white">{video.title}</h3>
            {video.description && (
              <p className="mt-1 text-sm text-white/60">{video.description}</p>
            )}
            {video.sourceUrl && (
              <a
                href={video.sourceUrl}
                target="_blank"
                rel="noopener"
                className="mt-2 inline-block text-xs text-white/40 underline decoration-white/20 hover:text-white/60"
              >
                Source: Official Mitsubishi Electric support
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── FAQ Accordion Row ── */
function FaqRow({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between py-3 text-left transition-colors"
        aria-expanded={open}
      >
        <span className="pr-3 text-sm font-medium text-gray-900">{item.question}</span>
        <ChevronDown
          className="h-4 w-4 flex-shrink-0 text-gray-400 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)' }}
        />
      </button>
      {open && (
        <div className="pb-3 pr-7 text-[13px] leading-relaxed text-gray-600">{item.answer}</div>
      )}
    </div>
  );
}

/* ── Main Screen ── */
export default function GuidesScreen() {
  const { installation, setActiveTab } = useCareApp();
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [playingVideo, setPlayingVideo] = useState<VideoItem | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const systemLabel = installation.system_size_kwp
    ? `${installation.system_size_kwp} kWp solar`
    : 'home';

  /* Filter logic */
  const q = searchQuery.trim().toLowerCase();
  const matchQuery = useCallback(
    (text: string) => (q ? text.toLowerCase().includes(q) : true),
    [q]
  );

  const visibleVideos = useMemo(() => {
    let vids: VideoItem[] = [];
    if (activeFilter === 'all' || activeFilter === 'solar') vids = vids.concat(solarVideos);
    if (activeFilter === 'all' || activeFilter === 'heat_pump') vids = vids.concat(heatPumpVideos);
    return vids.filter((v) => matchQuery(v.title) || matchQuery(v.source));
  }, [activeFilter, matchQuery]);

  const videosBySection = useMemo(() => {
    const map = new Map<string, VideoItem[]>();
    for (const v of visibleVideos) {
      if (!map.has(v.section)) map.set(v.section, []);
      map.get(v.section)!.push(v);
    }
    return Array.from(map.entries());
  }, [visibleVideos]);

  const visibleDocs = useMemo(() => {
    if (activeFilter !== 'all' && activeFilter !== 'documents') return [];
    return documents.filter((d) => matchQuery(d.title));
  }, [activeFilter, matchQuery]);

  const visibleFaqs = useMemo(() => {
    if (activeFilter !== 'all' && activeFilter !== 'faq') return [];
    return faqs.filter((f) => matchQuery(f.question) || matchQuery(f.answer));
  }, [activeFilter, matchQuery]);

  const noResults =
    visibleVideos.length === 0 && visibleDocs.length === 0 && visibleFaqs.length === 0;

  const filterChips: { key: FilterChip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'solar', label: 'Solar' },
    { key: 'heat_pump', label: 'Heat Pump' },
    { key: 'documents', label: 'Documents' },
    { key: 'faq', label: 'FAQ' },
  ];

  return (
    <div
      className="care-screen-scroll"
      style={{
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        paddingBottom: 100,
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ padding: '0 20px' }}>
        {/* Header */}
        <div
          style={{
            paddingTop: 32,
            marginBottom: 8,
            opacity: mounted ? 1 : 0,
            transform: mounted ? 'translateY(0)' : 'translateY(12px)',
            transition:
              'opacity 550ms cubic-bezier(.16, 1, .3, 1), transform 550ms cubic-bezier(.16, 1, .3, 1)',
          }}
        >
          <h1
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: '#1a1a1a',
              letterSpacing: '-0.03em',
              margin: '0 0 4px',
            }}
          >
            Guides &amp; Resources
          </h1>
          <p style={{ fontSize: 14, color: '#888', margin: '0 0 20px' }}>
            Tutorials for your {systemLabel} system
          </p>
        </div>

        {/* Search */}
        <RevealSection delay={0}>
          <div
            className="transition-all duration-150"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#F5F5F5',
              borderRadius: 14,
              padding: searchFocused ? '12px 18px' : '12px 16px',
              marginBottom: 12,
              border: searchFocused ? '1.5px solid #D4AF37' : '1.5px solid transparent',
              transition: 'border-color 150ms ease, padding 150ms ease',
            }}
          >
            <Search className="w-[18px] h-[18px] text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              placeholder="Search guides and documents..."
              style={{
                fontSize: 15,
                color: '#1a1a1a',
                fontWeight: 400,
                border: 'none',
                background: 'transparent',
                outline: 'none',
                width: '100%',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Filter chips */}
          <div
            className="flex gap-2 mb-6 overflow-x-auto pb-1"
            style={{ scrollbarWidth: 'none' }}
          >
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveFilter(chip.key)}
                className={`rounded-full px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] ${
                  activeFilter === chip.key
                    ? 'bg-[#D4AF37] text-white border border-[#D4AF37]'
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </RevealSection>

        {noResults ? (
          <RevealSection delay={60}>
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#999', fontSize: 14 }}>
              No results found{searchQuery ? ` for '${searchQuery}'` : ''}
            </div>
          </RevealSection>
        ) : (
          <>
            {/* Video sections */}
            {videosBySection.map(([section, items], idx) => (
              <RevealSection key={section} delay={60 + idx * 40}>
                <section style={{ marginBottom: 28 }}>
                  <h2
                    className="text-[15px] font-bold text-gray-900 mb-3"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    {section}
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {items.map((v) => (
                      <VideoCard key={v.id} video={v} onPlay={setPlayingVideo} />
                    ))}
                  </div>
                </section>
              </RevealSection>
            ))}

            {/* Documents */}
            {visibleDocs.length > 0 && (
              <RevealSection delay={180}>
                <section style={{ marginBottom: 28 }}>
                  <h2
                    className="text-[15px] font-bold text-gray-900 mb-3"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    Documents
                  </h2>
                  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
                    {visibleDocs.map((doc, i) => (
                      <button
                        key={doc.id}
                        type="button"
                        onClick={() => setActiveTab('assistant')}
                        className={`flex w-full items-center gap-3 px-3 py-3 text-left transition-colors hover:bg-gray-50 ${
                          i < visibleDocs.length - 1 ? 'border-b border-gray-100' : ''
                        }`}
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        <div
                          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                          style={{ background: '#FDF6E3' }}
                        >
                          <FileText className="h-4 w-4" style={{ color: '#D4AF37' }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {doc.title}
                          </p>
                          <p className="text-[11px] text-gray-500">{doc.subtitle}</p>
                        </div>
                        <Download className="h-4 w-4 flex-shrink-0 text-gray-400" />
                      </button>
                    ))}
                  </div>
                </section>
              </RevealSection>
            )}

            {/* FAQ */}
            {visibleFaqs.length > 0 && (
              <RevealSection delay={240}>
                <section style={{ marginBottom: 28 }}>
                  <h2
                    className="text-[15px] font-bold text-gray-900 mb-3"
                    style={{ letterSpacing: '-0.01em' }}
                  >
                    Frequently Asked Questions
                  </h2>
                  <div className="rounded-xl border border-gray-200 bg-white px-4">
                    {visibleFaqs.map((f) => (
                      <FaqRow key={f.id} item={f} />
                    ))}
                  </div>
                </section>
              </RevealSection>
            )}
          </>
        )}

        {/* Help banner */}
        <RevealSection delay={300}>
          <button
            onClick={() => setActiveTab('assistant')}
            className="w-full text-left rounded-2xl p-5 border-none cursor-pointer transition-all duration-150 active:scale-[0.97] hover:-translate-y-[3px] hover:shadow-md"
            style={{
              background: 'linear-gradient(135deg, #FDF8EF 0%, #F8ECDA 100%)',
              marginBottom: 24,
              fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
              >
                <HelpCircle className="w-[22px] h-[22px] text-white" />
              </div>
              <div>
                <div className="text-sm font-bold text-gray-900 mb-1">
                  Can&apos;t find what you need?
                </div>
                <div className="text-[13px] text-gray-500 leading-snug">
                  Ask our AI assistant for instant help with your system.
                </div>
              </div>
            </div>
          </button>
        </RevealSection>
      </div>

      {playingVideo && (
        <VideoModal video={playingVideo} onClose={() => setPlayingVideo(null)} />
      )}
    </div>
  );
}
