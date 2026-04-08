'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  HardHat, Plus, AlertTriangle, CheckCircle,
} from 'lucide-react';
import NewProjectModal from '@/components/select/builder/NewProjectModal';

// ─── Design tokens (from brief — scoped to builder route) ────────────────────
const colors = {
  bg:        '#0b0c0f',
  surface1:  '#0f1115',
  surface2:  '#12151b',
  surface3:  '#161a22',
  border:    '#1e2531',
  borderHover: 'rgba(212, 175, 55, 0.3)',
  borderGold: 'rgba(212, 175, 55, 0.2)',
  textPrimary:   '#eef2f8',
  textSecondary: '#9ca8bc',
  textMuted:     '#778199',
  gold:      '#D4AF37',
  goldGlow:  'rgba(212, 175, 55, 0.08)',
  green:     '#10B981',
  amber:     '#F59E0B',
  red:       '#EF4444',
  blue:      '#3B82F6',
} as const;

const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';

// ─── Build stage human-readable labels ───────────────────────────────────────
const STAGE_LABELS: Record<string, string> = {
  planning:          'Pre-Planning',
  site_prep:         'Site Preparation',
  foundations:        'Foundations',
  superstructure:     'Superstructure',
  roof:              'Roof',
  external_works:     'External Works',
  first_fix:         'First Fix',
  insulation:        'Insulation',
  plastering:        'Plastering',
  second_fix:        'Second Fix',
  kitchen_bathrooms:  'Kitchen & Bathrooms',
  external_finish:    'External Finish',
  snagging:          'Snagging',
  handover:          'Handover',
  complete:          'Complete',
};

// ─── Types ───────────────────────────────────────────────────────────────────
interface BuilderProject {
  id: string;
  builder_id: string;
  address: string;
  address_line_1: string | null;
  city: string | null;
  eircode: string | null;
  homeowner_name: string | null;
  homeowner_email: string | null;
  homeowner_phone: string | null;
  build_stage: string;
  target_handover_date: string | null;
  actual_handover_date: string | null;
  contract_price: number | null;
  hero_image_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface SnagCount {
  project_id: string;
  count: number;
}

interface SelectionCount {
  project_id: string;
  count: number;
}

// ─── Greeting ────────────────────────────────────────────────────────────────
function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

// ─── Days to handover ────────────────────────────────────────────────────────
function getDaysToHandover(targetDate: string | null): { text: string; color: string } {
  if (!targetDate) return { text: 'No date set', color: colors.textMuted };
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: 'Handover overdue', color: colors.red };
  if (diff < 8) return { text: `${diff} days to handover`, color: colors.red };
  if (diff <= 30) return { text: `${diff} days to handover`, color: colors.amber };
  return { text: `${diff} days to handover`, color: colors.textSecondary };
}

// ─── Morning summary ─────────────────────────────────────────────────────────
function MorningSummary({
  activeCount,
  totalOpenSnags,
  pendingSelections,
}: {
  activeCount: number;
  totalOpenSnags: number;
  pendingSelections: number;
}) {
  const parts: string[] = [];
  parts.push(`${activeCount} active project${activeCount !== 1 ? 's' : ''}`);
  if (totalOpenSnags > 0) {
    parts.push(`${totalOpenSnags} snag${totalOpenSnags !== 1 ? 's' : ''} need${totalOpenSnags === 1 ? 's' : ''} attention`);
  }
  if (pendingSelections > 0) {
    parts.push(`${pendingSelections} selection${pendingSelections !== 1 ? 's' : ''} awaiting sign-off`);
  }

  const allClear = totalOpenSnags === 0 && pendingSelections === 0;

  return (
    <div style={{
      fontSize: 13,
      color: allClear ? colors.green : colors.textSecondary,
      marginBottom: 28,
      lineHeight: 1.6,
    }}>
      {allClear && activeCount > 0
        ? 'All projects on track.'
        : parts.join(' · ')}
    </div>
  );
}

// ─── Active project card ─────────────────────────────────────────────────────
function ActiveProjectCard({
  project,
  openSnags,
  onClick,
}: {
  project: BuilderProject;
  openSnags: number;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const handover = getDaysToHandover(project.target_handover_date);
  const stageLabel = STAGE_LABELS[project.build_stage] || project.build_stage;
  const displayAddress = project.address_line_1 || project.address;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        cursor: 'pointer',
        position: 'relative',
        border: `1px solid ${hovered ? 'rgba(212, 175, 55, 0.35)' : colors.border}`,
        transform: pressed
          ? 'scale(0.98)'
          : hovered
            ? 'translateY(-3px)'
            : 'translateY(0)',
        boxShadow: hovered
          ? '0 12px 40px rgba(212, 175, 55, 0.1)'
          : 'none',
        transition: `transform 200ms ${EASE}, box-shadow 200ms ${EASE}, border-color 200ms ${EASE}`,
        background: colors.surface1,
      }}
    >
      {/* Hero image zone — top 60% */}
      <div style={{
        position: 'relative',
        width: '100%',
        paddingTop: '60%',
        overflow: 'hidden',
      }}>
        {project.hero_image_url ? (
          <img
            src={project.hero_image_url}
            alt={displayAddress}
            style={{
              position: 'absolute',
              top: 0, left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #12151b 0%, #0f1115 100%)',
          }} />
        )}
        {/* Dark overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.6) 100%)',
        }} />
        {/* Build stage pill */}
        <div style={{
          position: 'absolute',
          top: 12, left: 12,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 10px',
          borderRadius: 20,
          background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          border: '1px solid rgba(212,175,55,0.3)',
        }}>
          <span style={{
            width: 6, height: 6,
            borderRadius: '50%',
            background: colors.gold,
            flexShrink: 0,
          }} />
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.04em',
            color: colors.gold,
            whiteSpace: 'nowrap',
          }}>
            {stageLabel}
          </span>
        </div>
      </div>

      {/* Content zone — bottom 40% */}
      <div style={{
        padding: '14px 16px',
        background: colors.surface1,
      }}>
        <div style={{
          fontSize: 14,
          fontWeight: 600,
          color: colors.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {displayAddress}
        </div>
        <div style={{
          fontSize: 12,
          color: colors.textSecondary,
          marginTop: 2,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {project.homeowner_name || 'No homeowner assigned'}
        </div>
        {/* Gold hairline */}
        <div style={{
          height: 1,
          background: 'rgba(212, 175, 55, 0.12)',
          margin: '10px 0',
        }} />
        {/* Bottom row: days to handover + snag count */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <span style={{
            fontSize: 12,
            color: handover.color,
            fontWeight: handover.color !== colors.textSecondary ? 600 : 400,
          }}>
            {handover.text}
          </span>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
          }}>
            {openSnags === 0 ? (
              <>
                <CheckCircle size={14} color={colors.green} />
                <span style={{ color: colors.green }}>Clear</span>
              </>
            ) : (
              <>
                <AlertTriangle size={14} color={colors.amber} />
                <span style={{ color: colors.amber }}>{openSnags} open</span>
              </>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Completed project card ──────────────────────────────────────────────────
function CompletedProjectCard({
  project,
  onClick,
}: {
  project: BuilderProject;
  onClick: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const displayAddress = project.address_line_1 || project.address;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        cursor: 'pointer',
        height: 120,
        position: 'relative',
        border: `1px solid ${hovered ? 'rgba(212, 175, 55, 0.35)' : colors.border}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hovered ? '0 8px 24px rgba(212, 175, 55, 0.08)' : 'none',
        transition: `transform 200ms ${EASE}, box-shadow 200ms ${EASE}, border-color 200ms ${EASE}`,
        background: colors.surface1,
      }}
    >
      {/* Hero image or placeholder */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%',
        height: '100%',
      }}>
        {project.hero_image_url ? (
          <img
            src={project.hero_image_url}
            alt={displayAddress}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(135deg, #12151b 0%, #0f1115 100%)',
          }} />
        )}
        <div style={{
          position: 'absolute',
          top: 0, left: 0,
          width: '100%',
          height: '100%',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)',
        }} />
      </div>

      {/* Complete pill */}
      <div style={{
        position: 'absolute',
        top: 8, left: 8,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '3px 8px',
        borderRadius: 16,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid rgba(16, 185, 129, 0.3)`,
      }}>
        <CheckCircle size={10} color={colors.green} />
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: colors.green,
          letterSpacing: '0.04em',
        }}>
          Complete
        </span>
      </div>

      {/* Bottom content */}
      <div style={{
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        padding: '8px 12px',
      }}>
        <div style={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.textPrimary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {displayAddress}
        </div>
        <div style={{
          fontSize: 11,
          color: colors.textSecondary,
          marginTop: 1,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          {project.homeowner_name || ''}
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ─────────────────────────────────────────────────────────────
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '80px 24px',
      textAlign: 'center',
    }}>
      <HardHat size={48} color="rgba(212, 175, 55, 0.4)" />
      <div style={{
        fontSize: 18,
        fontWeight: 600,
        color: colors.textPrimary,
        marginTop: 16,
      }}>
        No projects yet
      </div>
      <div style={{
        fontSize: 14,
        color: colors.textSecondary,
        marginTop: 4,
      }}>
        Add your first project to get started.
      </div>
      <button
        onClick={onAdd}
        style={{
          marginTop: 24,
          padding: '8px 16px',
          background: colors.gold,
          color: colors.bg,
          fontWeight: 700,
          fontSize: 13,
          borderRadius: 10,
          border: 'none',
          cursor: 'pointer',
          transition: `filter 200ms ${EASE}, transform 200ms ${EASE}`,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.filter = 'brightness(1.08)';
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'brightness(1)';
          e.currentTarget.style.transform = 'translateY(0)';
        }}
      >
        + Add First Project
      </button>
    </div>
  );
}

// ─── Main page component ─────────────────────────────────────────────────────
export default function BuilderDashboard() {
  const supabase = createClientComponentClient();
  const [projects, setProjects] = useState<BuilderProject[]>([]);
  const [snagCounts, setSnagCounts] = useState<SnagCount[]>([]);
  const [selectionCounts, setSelectionCounts] = useState<SelectionCount[]>([]);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);

  useEffect(() => {
    async function loadData() {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const displayName = user.user_metadata?.full_name
        || user.user_metadata?.name
        || user.email?.split('@')[0]
        || 'Builder';
      setUserName(displayName.split(' ')[0]);

      // Fetch projects
      const { data: projectData } = await supabase
        .from('select_builder_projects')
        .select('*')
        .eq('builder_id', user.id)
        .order('status', { ascending: true })
        .order('target_handover_date', { ascending: true, nullsFirst: false });

      if (projectData) {
        setProjects(projectData);

        // Fetch open snag counts per project
        const projectIds = projectData.map((p) => p.id);
        if (projectIds.length > 0) {
          const { data: snagData } = await supabase
            .from('select_project_snags')
            .select('project_id')
            .in('project_id', projectIds)
            .in('status', ['open', 'in_progress']);

          if (snagData) {
            const counts: Record<string, number> = {};
            snagData.forEach((s: { project_id: string }) => {
              counts[s.project_id] = (counts[s.project_id] || 0) + 1;
            });
            setSnagCounts(
              Object.entries(counts).map(([project_id, count]) => ({
                project_id,
                count,
              }))
            );
          }

          // Fetch pending selection counts
          const { data: selData } = await supabase
            .from('select_project_selections')
            .select('project_id')
            .in('project_id', projectIds)
            .in('status', ['pending', 'sent']);

          if (selData) {
            const counts: Record<string, number> = {};
            selData.forEach((s: { project_id: string }) => {
              counts[s.project_id] = (counts[s.project_id] || 0) + 1;
            });
            setSelectionCounts(
              Object.entries(counts).map(([project_id, count]) => ({
                project_id,
                count,
              }))
            );
          }
        }
      }

      setLoading(false);
    }

    loadData();
  }, [supabase]);

  const activeProjects = useMemo(
    () => projects.filter((p) => p.status === 'active'),
    [projects]
  );

  const completedProjects = useMemo(
    () => projects.filter((p) => p.status === 'complete' || p.status === 'archived'),
    [projects]
  );

  const totalOpenSnags = useMemo(
    () => snagCounts.reduce((sum, s) => sum + s.count, 0),
    [snagCounts]
  );

  const totalPendingSelections = useMemo(
    () => selectionCounts.reduce((sum, s) => sum + s.count, 0),
    [selectionCounts]
  );

  function getOpenSnags(projectId: string): number {
    return snagCounts.find((s) => s.project_id === projectId)?.count || 0;
  }

  function handleNewProject() {
    setShowNewProject(true);
  }

  function handleProjectClick(projectId: string) {
    window.location.href = `/builder/${projectId}`;
  }

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        color: colors.textSecondary,
        fontSize: 14,
      }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{
      maxWidth: 960,
      margin: '0 auto',
      padding: '0 20px',
    }}>
      {/* ─── Header ─── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingTop: 32,
        paddingBottom: 8,
      }}>
        <div>
          {/* Logo + brand */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 8,
          }}>
            <img
              src="/oh-logo-icon.png"
              alt="OpenHouse"
              style={{ width: 28, height: 28 }}
            />
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: colors.gold,
            }}>
              OpenHouse Select
            </span>
          </div>
          {/* Greeting */}
          <h1 style={{
            fontSize: 22,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: colors.textPrimary,
            margin: 0,
          }}>
            {getGreeting()}, {userName}.
          </h1>
        </div>

        {/* New project button */}
        <button
          onClick={handleNewProject}
          style={{
            padding: '8px 16px',
            background: colors.gold,
            color: colors.bg,
            fontWeight: 700,
            fontSize: 13,
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            transition: `filter 200ms ${EASE}, transform 200ms ${EASE}`,
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.filter = 'brightness(1.08)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.filter = 'brightness(1)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <Plus size={14} strokeWidth={3} />
          New Project
        </button>
      </div>

      {/* ─── Gold hairline ─── */}
      <div style={{
        height: 1,
        background: 'rgba(212, 175, 55, 0.12)',
        margin: '12px 0 20px',
      }} />

      {/* ─── Empty state ─── */}
      {projects.length === 0 && (
        <EmptyState onAdd={handleNewProject} />
      )}

      {projects.length > 0 && (
        <>
          {/* ─── Morning summary ─── */}
          <MorningSummary
            activeCount={activeProjects.length}
            totalOpenSnags={totalOpenSnags}
            pendingSelections={totalPendingSelections}
          />

          {/* ─── Active projects ─── */}
          {activeProjects.length > 0 && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: colors.gold,
                }}>
                  Active Projects
                </span>
                <span style={{
                  fontSize: 12,
                  color: colors.textMuted,
                }}>
                  ({activeProjects.length})
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: 20,
                marginBottom: 40,
              }}>
                {activeProjects.map((project) => (
                  <ActiveProjectCard
                    key={project.id}
                    project={project}
                    openSnags={getOpenSnags(project.id)}
                    onClick={() => handleProjectClick(project.id)}
                  />
                ))}
              </div>
            </>
          )}

          {/* ─── Completed projects ─── */}
          {completedProjects.length > 0 && (
            <>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flex: 1,
                }}>
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: colors.gold,
                  }}>
                    Completed
                  </span>
                  <div style={{
                    flex: 1,
                    height: 1,
                    background: 'rgba(212, 175, 55, 0.12)',
                  }} />
                </div>
                <span style={{
                  fontSize: 12,
                  color: colors.textMuted,
                  marginLeft: 12,
                }}>
                  ({completedProjects.length})
                </span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 16,
                paddingBottom: 40,
              }}>
                {completedProjects.map((project) => (
                  <CompletedProjectCard
                    key={project.id}
                    project={project}
                    onClick={() => handleProjectClick(project.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      {showNewProject && userId && (
        <NewProjectModal
          builderId={userId}
          onClose={() => setShowNewProject(false)}
          onCreated={(id) => {
            setShowNewProject(false);
            window.location.href = `/builder/${id}`;
          }}
        />
      )}
    </div>
  );
}
