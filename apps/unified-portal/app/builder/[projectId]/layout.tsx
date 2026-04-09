'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  ArrowLeft, LayoutDashboard, GitBranch, Camera,
  CheckSquare, FolderOpen, AlertTriangle, Sparkles,
  User, Key,
} from 'lucide-react';
import {
  colors, EASE, STAGE_LABELS,
  type BuilderProject,
} from '@/components/select/builder/tokens';

const NAV_ITEMS = [
  { id: 'overview',   label: 'Overview',        icon: LayoutDashboard, href: '' },
  { id: 'timeline',   label: 'Build Timeline',  icon: GitBranch,       href: '/timeline' },
  { id: 'photos',     label: 'Photos',          icon: Camera,          href: '/photos' },
  { id: 'selections', label: 'Selections',      icon: CheckSquare,     href: '/selections' },
  { id: 'documents',  label: 'Documents',       icon: FolderOpen,      href: '/documents' },
  { id: 'snags',      label: 'Snags',           icon: AlertTriangle,   href: '/snags' },
  { id: 'intelligence', label: 'Intelligence',  icon: Sparkles,        href: '/intelligence' },
  { id: 'homeowner',  label: 'Homeowner',       icon: User,            href: '/homeowner' },
  { id: 'handover',   label: 'Handover',        icon: Key,             href: '/handover' },
] as const;

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.projectId as string;
  const supabase = createClientComponentClient();

  const [project, setProject] = useState<BuilderProject | null>(null);
  const [openSnags, setOpenSnags] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('select_builder_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (data) setProject(data);

      const { data: snagData } = await supabase
        .from('select_project_snags')
        .select('id')
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress']);
      if (snagData) setOpenSnags(snagData.length);
    }
    load();
  }, [supabase, projectId]);

  const getActiveTab = useCallback(() => {
    const base = `/builder/${projectId}`;
    const sub = pathname.replace(base, '');
    if (!sub || sub === '/') return 'overview';
    const match = NAV_ITEMS.find((n) => n.href && sub.startsWith(n.href));
    return match?.id || 'overview';
  }, [pathname, projectId]);

  const activeTab = getActiveTab();
  const stageLabel = project ? (STAGE_LABELS[project.build_stage] || project.build_stage) : '';

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* ─── Desktop Sidebar ─── */}
      <aside style={{
        width: 240,
        flexShrink: 0,
        background: colors.surface1,
        borderRight: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 40,
        transition: `transform 300ms ${EASE}`,
      }}
      className="builder-sidebar"
      >
        {/* Back link */}
        <a
          href="/builder"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '16px 16px 12px',
            color: colors.textSecondary,
            textDecoration: 'none',
            fontSize: 14,
            transition: `color 200ms ${EASE}`,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = colors.textPrimary; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = colors.textSecondary; }}
        >
          <ArrowLeft size={16} />
          All Projects
        </a>

        {/* Project identity block */}
        {project && (
          <div style={{ padding: '8px 16px 16px' }}>
            <div style={{
              width: 60,
              height: 60,
              borderRadius: 10,
              overflow: 'hidden',
              background: colors.surface3,
              marginBottom: 10,
            }}>
              {project.hero_image_url ? (
                <img
                  src={project.hero_image_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(135deg, #12151b, #0f1115)',
                }} />
              )}
            </div>
            <div style={{
              fontSize: 14,
              fontWeight: 600,
              color: colors.textPrimary,
              lineHeight: 1.3,
              marginBottom: 2,
            }}>
              {project.address_line_1 || project.address}
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 8 }}>
              {project.homeowner_name || 'No homeowner'}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '3px 8px',
              borderRadius: 16,
              background: 'rgba(0,0,0,0.4)',
              border: '1px solid rgba(212,175,55,0.3)',
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: colors.gold,
              }} />
              <span style={{
                fontSize: 10, fontWeight: 600,
                letterSpacing: '0.04em', color: colors.gold,
              }}>
                {stageLabel}
              </span>
            </div>
          </div>
        )}

        {/* Gold hairline */}
        <div style={{ height: 1, background: 'rgba(212,175,55,0.12)', margin: '0 16px' }} />

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={`/builder/${projectId}${item.href}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '9px 16px',
                  color: isActive ? colors.gold : colors.textMuted,
                  textDecoration: 'none',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 400,
                  borderLeft: isActive ? `3px solid ${colors.gold}` : '3px solid transparent',
                  transition: `all 200ms ${EASE}`,
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.color = colors.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.color = colors.textMuted;
                }}
              >
                <Icon size={16} />
                <span>{item.label}</span>
                {item.id === 'snags' && openSnags > 0 && (
                  <span style={{
                    marginLeft: 'auto',
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: colors.amber,
                    color: colors.bg,
                    fontSize: 10,
                    fontWeight: 700,
                  }}>
                    {openSnags}
                  </span>
                )}
              </a>
            );
          })}
        </nav>
      </aside>

      {/* ─── Mobile bottom tab bar ─── */}
      <nav
        className="builder-mobile-tabs"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: colors.surface1,
          borderTop: `1px solid ${colors.border}`,
          display: 'none',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        }}
      >
        <div style={{
          display: 'flex',
          minWidth: 'max-content',
          padding: '0 4px',
        }}>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.id;
            const Icon = item.icon;
            return (
              <a
                key={item.id}
                href={`/builder/${projectId}${item.href}`}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 2,
                  padding: '8px 10px 6px',
                  color: isActive ? colors.gold : colors.textMuted,
                  textDecoration: 'none',
                  fontSize: 9,
                  fontWeight: isActive ? 600 : 400,
                  borderBottom: isActive ? `2px solid ${colors.gold}` : '2px solid transparent',
                  position: 'relative',
                  minWidth: 56,
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
                {item.id === 'snags' && openSnags > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 4, right: 4,
                    width: 14, height: 14,
                    borderRadius: '50%',
                    background: colors.amber,
                    color: colors.bg,
                    fontSize: 8,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {openSnags}
                  </span>
                )}
              </a>
            );
          })}
        </div>
      </nav>

      {/* ─── Main content area ─── */}
      <main
        className="builder-main"
        style={{
          flex: 1,
          marginLeft: 240,
          padding: '24px 28px 80px',
          minHeight: '100vh',
        }}
      >
        {children}
      </main>

      {/* ─── Responsive styles ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .builder-sidebar { display: none !important; }
          .builder-mobile-tabs { display: flex !important; }
          .builder-main { margin-left: 0 !important; padding: 16px 16px 80px !important; }
        }
      `}} />
    </div>
  );
}
