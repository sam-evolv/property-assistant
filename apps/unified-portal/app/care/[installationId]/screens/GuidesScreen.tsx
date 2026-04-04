'use client';

import { useEffect, useRef, useState } from 'react';
import { useCareApp } from '../care-app-provider';
import {
  Search,
  Play,
  FileText,
  BookOpen,
  Wrench,
  HelpCircle,
  Clock,
  ArrowRight,
  Shield,
  Award,
  CheckCircle,
  File,
} from 'lucide-react';

/* ── Scroll Reveal Hook ── */
function useScrollReveal(threshold = 0.1) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const prefersReduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
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

/* ── Reveal Section Wrapper ── */
function RevealSection({
  children,
  delay = 0,
}: {
  children: React.ReactNode;
  delay?: number;
}) {
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

/* ── Filter chip types ── */
type FilterChip = 'all' | 'video' | 'pdf' | 'interactive' | 'troubleshooting';

/* ── Doc icon color mapping ── */
function getDocIconColor(title: string): { bg: string; border: string; icon: React.ElementType } {
  const t = title.toLowerCase();
  if (t.includes('manual') || t.includes('user')) return { bg: 'bg-blue-100', border: 'border-blue-300', icon: BookOpen };
  if (t.includes('commission')) return { bg: 'bg-[#D4AF37]/10', border: 'border-[#D4AF37]/40', icon: CheckCircle };
  if (t.includes('warranty')) return { bg: 'bg-green-100', border: 'border-green-300', icon: Shield };
  if (t.includes('compliance') || t.includes('cert')) return { bg: 'bg-purple-100', border: 'border-purple-300', icon: Award };
  if (t.includes('grant') || t.includes('seai')) return { bg: 'bg-amber-100', border: 'border-amber-300', icon: File };
  return { bg: 'bg-orange-100', border: 'border-orange-300', icon: FileText };
}

function getDocIconTextColor(title: string): string {
  const t = title.toLowerCase();
  if (t.includes('manual') || t.includes('user')) return 'text-blue-600';
  if (t.includes('commission')) return 'text-[#D4AF37]';
  if (t.includes('warranty')) return 'text-green-600';
  if (t.includes('compliance') || t.includes('cert')) return 'text-purple-600';
  if (t.includes('grant') || t.includes('seai')) return 'text-amber-600';
  return 'text-orange-600';
}

interface ContentItem {
  id: string;
  title: string;
  content_type: string;
  category: string | null;
  description: string | null;
  view_count: number;
}

const typeGradients: Record<string, string> = {
  video: 'linear-gradient(135deg, #D4AF37, #B8934C)',
  document: 'linear-gradient(135deg, #3B82F6, #2563EB)',
  guide: 'linear-gradient(135deg, #8B5CF6, #6D28D9)',
  faq: 'linear-gradient(135deg, #10B981, #059669)',
};

export default function GuidesScreen() {
  const { installation, installationId, setActiveTab } = useCareApp();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<Record<string, ContentItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');

  useEffect(() => {
    setMounted(true);
    const fetchContent = async () => {
      try {
        const res = await fetch(`/api/care/content?installation_id=${installationId}`);
        if (res.ok) {
          const data = await res.json();
          setContent(data.content || {});
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchContent();
  }, [installationId]);

  // Build guide sections from fetched content, falling back to defaults
  const videoGuides = (content.video || []).map((c) => ({
    title: c.title,
    duration: `${c.view_count} views`,
    meta: `Video`,
    iconBg: typeGradients.video,
  }));
  const documents = (content.document || []).map((c) => ({
    title: c.title,
    meta: 'PDF',
    size: '',
    iconBg: typeGradients.document,
  }));
  const troubleshooting = (content.guide || content.faq || []).map((c) => ({
    title: c.title,
    description: c.description || 'Step-by-step diagnostic guide',
    meta: c.content_type === 'faq' ? 'FAQ' : 'Guide',
    iconBg: typeGradients[c.content_type] || typeGradients.guide,
  }));

  // If no data loaded yet, use fallback content based on system type
  const isHeatPump = installation.system_category === 'heat_pump' || installation.system_type === 'heat_pump';

  if (!loading && videoGuides.length === 0 && documents.length === 0 && troubleshooting.length === 0) {
    if (isHeatPump) {
      videoGuides.push(
        { title: 'Understanding Your Heat Pump Dashboard', duration: '4 min', meta: 'Video', iconBg: typeGradients.video },
        { title: 'Getting the Most from Underfloor Heating', duration: '6 min', meta: 'Video', iconBg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
        { title: 'How to Read Your Energy Bill', duration: '5 min', meta: 'Video', iconBg: 'linear-gradient(135deg, #8B5CF6, #7C3AED)' },
      );
      documents.push(
        { title: `${installation.heat_pump_model || 'Heat Pump'} User Manual`, meta: 'PDF', size: '2.4 MB', iconBg: typeGradients.document },
        { title: 'Pipelife Underfloor Heating Guide', meta: 'PDF', size: '1.8 MB', iconBg: typeGradients.document },
        { title: 'SEAI Grant - What to Expect', meta: 'PDF', size: '0.9 MB', iconBg: 'linear-gradient(135deg, #10B981, #059669)' },
        { title: `${installation.controls_model || 'Thermostat'} Setup Guide`, meta: 'PDF', size: '1.2 MB', iconBg: typeGradients.document },
      );
      troubleshooting.push(
        { title: 'Heat Pump Error Codes Guide', description: 'Look up error codes and find step-by-step fixes for common heat pump issues.', meta: 'Interactive Guide', iconBg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
        { title: 'Thermostat Not Responding', description: 'Diagnose and fix unresponsive thermostat or zone controller issues.', meta: 'Step-by-step', iconBg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
        { title: 'Underfloor Heating Not Heating', description: 'Check flow rates, valve positions and zone settings to restore heating.', meta: 'Diagnostic', iconBg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
      );
    } else {
      videoGuides.push(
        { title: 'Understanding Your Solar Dashboard', duration: '4 min', meta: 'Video', iconBg: typeGradients.video },
        { title: 'Maximising Self-Consumption', duration: '6 min', meta: 'Video', iconBg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
      );
      documents.push(
        { title: `${installation.inverter_model} Manual`, meta: 'PDF', size: '3.1 MB', iconBg: typeGradients.document },
      );
      troubleshooting.push(
        { title: 'Inverter Error Codes Guide', description: 'Look up error codes and find step-by-step fixes for common inverter issues.', meta: 'Interactive Guide', iconBg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
      );
    }
  }

  // Filter by search query
  const q = searchQuery.toLowerCase();
  let filteredVideos = q ? videoGuides.filter(g => g.title.toLowerCase().includes(q)) : videoGuides;
  let filteredDocs = q ? documents.filter(g => g.title.toLowerCase().includes(q)) : documents;
  let filteredTrouble = q ? troubleshooting.filter(g => g.title.toLowerCase().includes(q)) : troubleshooting;

  // Apply chip filter
  if (activeFilter === 'video') {
    filteredDocs = [];
    filteredTrouble = [];
  } else if (activeFilter === 'pdf') {
    filteredVideos = [];
    filteredTrouble = [];
  } else if (activeFilter === 'interactive' || activeFilter === 'troubleshooting') {
    filteredVideos = [];
    filteredDocs = [];
  }

  const noResults = (q || activeFilter !== 'all') && filteredVideos.length === 0 && filteredDocs.length === 0 && filteredTrouble.length === 0;

  const filterChips: { key: FilterChip; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'video', label: 'Video' },
    { key: 'pdf', label: 'PDF' },
    { key: 'interactive', label: 'Interactive' },
    { key: 'troubleshooting', label: 'Troubleshooting' },
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
        {/* -- Header -- */}
        <div
          style={{
            paddingTop: 56,
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
            Guides & Resources
          </h1>
          <p
            style={{
              fontSize: 14,
              color: '#888',
              margin: '0 0 20px',
            }}
          >
            Everything you need for your {isHeatPump ? (installation.heat_pump_model || 'heating') : `${installation.system_size_kwp} kWp`} system
          </p>
        </div>

        {/* -- Search Bar with focus effect -- */}
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

          {/* -- Filter Chips -- */}
          <div className="flex gap-2 mb-6 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {filterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setActiveFilter(chip.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap transition-all duration-150 active:scale-[0.97] ${
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
            {/* -- Video Guides: 2-col tile grid -- */}
            {filteredVideos.length > 0 && (
              <RevealSection delay={60}>
                <div style={{ marginBottom: 28 }}>
                  <h2 className="text-[17px] font-bold text-gray-900 mb-3" style={{ letterSpacing: '-0.02em' }}>
                    Video Guides
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredVideos.map((guide, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveTab('assistant')}
                        className="text-left rounded-2xl overflow-hidden transition-all duration-150 active:scale-[0.97] hover:-translate-y-[3px] hover:shadow-md group"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {/* Thumbnail area */}
                        <div
                          className="relative w-full overflow-hidden"
                          style={{ aspectRatio: '16/9' }}
                        >
                          {/* Warm gradient background (no thumbnail) */}
                          <div
                            className="absolute inset-0"
                            style={{ background: guide.iconBg || 'linear-gradient(135deg, #D4AF37, #B8934C)' }}
                          />
                          {/* Dark gradient overlay */}
                          <div
                            className="absolute inset-0"
                            style={{ background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 60%)' }}
                          />
                          {/* Play button */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center transition-transform duration-150 group-hover:scale-110">
                              <Play className="w-5 h-5 text-gray-900 ml-0.5" fill="currentColor" />
                            </div>
                          </div>
                          {/* Duration chip */}
                          <div className="absolute bottom-2 right-2">
                            <span className="text-[11px] font-medium text-white bg-black/50 rounded px-1.5 py-0.5 backdrop-blur-sm flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {guide.duration}
                            </span>
                          </div>
                        </div>
                        {/* Title below tile */}
                        <div className="pt-2 pb-1 px-0.5">
                          <p className="text-xs font-semibold text-gray-900 leading-tight line-clamp-2">
                            {guide.title}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </RevealSection>
            )}

            {/* -- Documents: 2-col tile grid -- */}
            {filteredDocs.length > 0 && (
              <RevealSection delay={120}>
                <div style={{ marginBottom: 28 }}>
                  <h2 className="text-[17px] font-bold text-gray-900 mb-3" style={{ letterSpacing: '-0.02em' }}>
                    Documents
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredDocs.map((doc, i) => {
                      const docStyle = getDocIconColor(doc.title);
                      const DocIcon = docStyle.icon;
                      const iconTextColor = getDocIconTextColor(doc.title);
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setActiveTab('assistant')}
                          className={`text-left rounded-xl border border-gray-200 bg-white p-3 transition-all duration-150 active:scale-[0.97] hover:-translate-y-[3px] hover:shadow-md hover:${docStyle.border}`}
                          style={{ WebkitTapHighlightColor: 'transparent' }}
                        >
                          {/* Icon square */}
                          <div className={`w-8 h-8 rounded-lg ${docStyle.bg} flex items-center justify-center mb-2.5`}>
                            <DocIcon className={`w-4 h-4 ${iconTextColor}`} />
                          </div>
                          {/* Title */}
                          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 mb-1.5">
                            {doc.title}
                          </p>
                          {/* Meta */}
                          <p className="text-[11px] text-gray-400 font-medium">
                            {doc.meta}{doc.size ? ` \u00B7 ${doc.size}` : ''}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </RevealSection>
            )}

            {/* -- Troubleshooting: 2-col tile grid -- */}
            {filteredTrouble.length > 0 && (
              <RevealSection delay={180}>
                <div style={{ marginBottom: 28 }}>
                  <h2 className="text-[17px] font-bold text-gray-900 mb-3" style={{ letterSpacing: '-0.02em' }}>
                    Troubleshooting
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {filteredTrouble.map((item, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setActiveTab('assistant')}
                        className="text-left rounded-xl border border-gray-200 bg-white overflow-hidden transition-all duration-150 active:scale-[0.97] hover:-translate-y-[3px] hover:shadow-md"
                        style={{ WebkitTapHighlightColor: 'transparent' }}
                      >
                        {/* Red-to-orange gradient strip */}
                        <div className="h-1" style={{ background: 'linear-gradient(90deg, #EF4444, #F97316)' }} />
                        <div className="p-3">
                          {/* Interactive chip */}
                          <div className="flex justify-end mb-2">
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-purple-600 bg-purple-50 border border-purple-200 rounded-full px-2 py-0.5">
                              Interactive
                            </span>
                          </div>
                          {/* Title */}
                          <p className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2 mb-1.5">
                            {item.title}
                          </p>
                          {/* Description */}
                          <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2 mb-3">
                            {item.description}
                          </p>
                          {/* Gold link */}
                          <span className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1">
                            Start guide
                            <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </RevealSection>
            )}
          </>
        )}

        {/* -- Help Banner -- */}
        <RevealSection delay={240}>
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
    </div>
  );
}
