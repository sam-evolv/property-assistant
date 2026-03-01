'use client';

import { useEffect, useRef, useState } from 'react';
import { useCareApp } from '../care-app-provider';

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

/* ── Guide Item ── */
function GuideItem({
  icon,
  iconBg,
  title,
  meta,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  meta: string;
}) {
  const [pressed, setPressed] = useState(false);

  return (
    <button
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        width: '100%',
        padding: '14px 16px',
        background: '#FAFAFA',
        border: 'none',
        borderRadius: 16,
        cursor: 'pointer',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'transform 200ms cubic-bezier(.34, 1.56, .64, 1)',
        fontFamily: 'inherit',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: '#1a1a1a',
            marginBottom: 3,
          }}
        >
          {title}
        </div>
        <div style={{ fontSize: 12, color: '#999', fontWeight: 500 }}>
          {meta}
        </div>
      </div>
      <svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill="none"
        stroke="#ccc"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </button>
  );
}

/* ── Inline SVG Icons ── */
const PlayIcon = (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const FileIcon = (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const WrenchIcon = (
  <svg
    width={20}
    height={20}
    viewBox="0 0 24 24"
    fill="none"
    stroke="white"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
  </svg>
);

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

const typeIcons: Record<string, React.ReactNode> = {
  video: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
  ),
  document: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
  ),
  guide: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" /><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" /></svg>
  ),
  faq: (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
  ),
};

export default function GuidesScreen() {
  const { installation, installationId } = useCareApp();
  const [mounted, setMounted] = useState(false);
  const [content, setContent] = useState<Record<string, ContentItem[]>>({});
  const [loading, setLoading] = useState(true);

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
    meta: `Video · ${c.view_count} views`,
    iconBg: typeGradients.video,
  }));
  const documents = (content.document || []).map((c) => ({
    title: c.title,
    meta: 'PDF',
    iconBg: typeGradients.document,
  }));
  const troubleshooting = (content.guide || content.faq || []).map((c) => ({
    title: c.title,
    meta: c.content_type === 'faq' ? 'FAQ' : 'Guide',
    iconBg: typeGradients[c.content_type] || typeGradients.guide,
  }));

  // If no data loaded yet, use fallback
  if (!loading && videoGuides.length === 0 && documents.length === 0 && troubleshooting.length === 0) {
    videoGuides.push(
      { title: 'Understanding Your Solar Dashboard', meta: 'Video · 4 min', iconBg: typeGradients.video },
      { title: 'Maximising Self-Consumption', meta: 'Video · 6 min', iconBg: 'linear-gradient(135deg, #F59E0B, #D97706)' },
    );
    documents.push(
      { title: `${installation.inverter_model} Manual`, meta: 'PDF', iconBg: typeGradients.document },
    );
    troubleshooting.push(
      { title: 'Inverter Error Codes Guide', meta: 'Interactive Guide', iconBg: 'linear-gradient(135deg, #EF4444, #DC2626)' },
    );
  }

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
        {/* ── Header ── */}
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
            Everything you need for your {installation.system_size_kwp} kWp
            system
          </p>
        </div>

        {/* ── Search Bar (read-only placeholder) ── */}
        <RevealSection delay={0}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              background: '#F5F5F5',
              borderRadius: 14,
              padding: '12px 16px',
              marginBottom: 28,
            }}
          >
            <svg
              width={18}
              height={18}
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span
              style={{
                fontSize: 15,
                color: '#bbb',
                fontWeight: 400,
              }}
            >
              Search guides and documents...
            </span>
          </div>
        </RevealSection>

        {/* ── Video Guides ── */}
        <RevealSection delay={60}>
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: 12,
                letterSpacing: '-0.02em',
              }}
            >
              Video Guides
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {videoGuides.map((guide, i) => (
                <GuideItem
                  key={i}
                  icon={PlayIcon}
                  iconBg={guide.iconBg}
                  title={guide.title}
                  meta={guide.meta}
                />
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ── Documents ── */}
        <RevealSection delay={120}>
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: 12,
                letterSpacing: '-0.02em',
              }}
            >
              Documents
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {documents.map((doc, i) => (
                <GuideItem
                  key={i}
                  icon={FileIcon}
                  iconBg={doc.iconBg}
                  title={doc.title}
                  meta={doc.meta}
                />
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ── Troubleshooting ── */}
        <RevealSection delay={180}>
          <div style={{ marginBottom: 28 }}>
            <h2
              style={{
                fontSize: 17,
                fontWeight: 700,
                color: '#1a1a1a',
                marginBottom: 12,
                letterSpacing: '-0.02em',
              }}
            >
              Troubleshooting
            </h2>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {troubleshooting.map((item, i) => (
                <GuideItem
                  key={i}
                  icon={WrenchIcon}
                  iconBg={item.iconBg}
                  title={item.title}
                  meta={item.meta}
                />
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ── Help Banner ── */}
        <RevealSection delay={240}>
          <div
            style={{
              borderRadius: 20,
              padding: 20,
              background:
                'linear-gradient(135deg, #FDF8EF 0%, #F8ECDA 100%)',
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #D4AF37, #B8934C)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <svg
                  width={22}
                  height={22}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#1a1a1a',
                    marginBottom: 4,
                  }}
                >
                  Can&apos;t find what you need?
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: '#888',
                    lineHeight: 1.4,
                  }}
                >
                  Ask our AI assistant for instant help with your system.
                </div>
              </div>
            </div>
          </div>
        </RevealSection>
      </div>
    </div>
  );
}
