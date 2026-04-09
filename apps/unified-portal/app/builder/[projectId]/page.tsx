'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import {
  AlertTriangle, CheckCircle, Camera, CheckSquare,
  FileText, Clock, ArrowRight, Calendar,
} from 'lucide-react';
import {
  colors, EASE, STAGE_LABELS, BUILD_STAGES, getDaysToHandover,
  type BuilderProject,
} from '@/components/select/builder/tokens';

interface Milestone {
  id: string;
  stage: string;
  label: string;
  target_date: string | null;
  completed_at: string | null;
}

interface AttentionItem {
  icon: React.ReactNode;
  text: string;
  link: string;
  severity: 'red' | 'amber';
}

export default function ProjectOverview() {
  const params = useParams();
  const projectId = params.projectId as string;
  const supabase = createClientComponentClient();

  const [project, setProject] = useState<BuilderProject | null>(null);
  const [openSnags, setOpenSnags] = useState(0);
  const [oldSnags, setOldSnags] = useState(0);
  const [sharedPhotos, setSharedPhotos] = useState(0);
  const [totalSelections, setTotalSelections] = useState(0);
  const [approvedSelections, setApprovedSelections] = useState(0);
  const [pendingSelections, setPendingSelections] = useState(0);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [recentActivity, setRecentActivity] = useState<{ text: string; time: string; icon: React.ReactNode }[]>([]);
  const [hasBer, setHasBer] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      // Fetch project
      const { data: proj } = await supabase
        .from('select_builder_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (proj) setProject(proj);

      // Fetch open snags
      const { data: snags } = await supabase
        .from('select_project_snags')
        .select('id, created_at, status')
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress']);
      if (snags) {
        setOpenSnags(snags.length);
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        setOldSnags(snags.filter((s) => new Date(s.created_at) < fiveDaysAgo).length);
      }

      // Fetch photos
      const { data: photos } = await supabase
        .from('select_project_photos')
        .select('id, visibility')
        .eq('project_id', projectId);
      if (photos) setSharedPhotos(photos.filter((p) => p.visibility === 'shared').length);

      // Fetch selections
      const { data: selections } = await supabase
        .from('select_project_selections')
        .select('id, status')
        .eq('project_id', projectId);
      if (selections) {
        setTotalSelections(selections.length);
        setApprovedSelections(selections.filter((s) => s.status === 'approved' || s.status === 'finalised').length);
        setPendingSelections(selections.filter((s) => s.status === 'pending' || s.status === 'sent').length);
      }

      // Fetch milestones
      const { data: ms } = await supabase
        .from('select_project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true });
      if (ms) setMilestones(ms);

      // Check for BER cert
      const { data: docs } = await supabase
        .from('select_project_documents')
        .select('id, category')
        .eq('project_id', projectId)
        .eq('category', 'ber');
      if (docs && docs.length > 0) setHasBer(true);

      setLoading(false);
    }
    load();
  }, [supabase, projectId]);

  // ─── Attention items ─────────────────────────────────────────────────────
  const attentionItems = useMemo<AttentionItem[]>(() => {
    if (!project) return [];
    const items: AttentionItem[] = [];
    if (oldSnags > 0) {
      items.push({
        icon: <AlertTriangle size={14} />,
        text: `${oldSnags} snag${oldSnags !== 1 ? 's' : ''} open for 5+ days — needs resolution`,
        link: `/builder/${projectId}/snags`,
        severity: 'red',
      });
    }
    if (pendingSelections > 0) {
      items.push({
        icon: <CheckSquare size={14} />,
        text: `${pendingSelections} selection${pendingSelections !== 1 ? 's' : ''} awaiting homeowner sign-off`,
        link: `/builder/${projectId}/selections`,
        severity: 'amber',
      });
    }
    if (!hasBer) {
      items.push({
        icon: <FileText size={14} />,
        text: 'BER cert not yet uploaded',
        link: `/builder/${projectId}/documents`,
        severity: 'amber',
      });
    }
    return items;
  }, [project, oldSnags, pendingSelections, hasBer, projectId]);

  // ─── Build stage progress ────────────────────────────────────────────────
  const currentStageIndex = project ? BUILD_STAGES.indexOf(project.build_stage as typeof BUILD_STAGES[number]) : 0;
  const nextStage = currentStageIndex < BUILD_STAGES.length - 1
    ? STAGE_LABELS[BUILD_STAGES[currentStageIndex + 1]]
    : null;

  // ─── Upcoming milestones ─────────────────────────────────────────────────
  const upcomingMilestones = useMemo(() => {
    return milestones
      .filter((m) => !m.completed_at && m.target_date)
      .sort((a, b) => new Date(a.target_date!).getTime() - new Date(b.target_date!).getTime())
      .slice(0, 3);
  }, [milestones]);

  const handover = project ? getDaysToHandover(project.target_handover_date) : { text: '-', color: colors.textMuted, days: null };

  if (loading) {
    return (
      <div style={{ color: colors.textSecondary, fontSize: 14, padding: 40 }}>
        Loading...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ color: colors.textSecondary, fontSize: 14, padding: 40 }}>
        Project not found.
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720 }}>
      {/* ─── Attention items ─── */}
      {attentionItems.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 28 }}>
          {attentionItems.map((item, i) => (
            <a
              key={i}
              href={item.link}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                background: colors.surface1,
                border: `1px solid ${colors.border}`,
                borderLeft: `3px solid ${item.severity === 'red' ? colors.red : colors.amber}`,
                color: colors.textSecondary,
                textDecoration: 'none',
                fontSize: 13,
                transition: `border-color 200ms ${EASE}`,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = colors.borderHover; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = colors.border; }}
            >
              <span style={{ color: item.severity === 'red' ? colors.red : colors.amber, flexShrink: 0 }}>
                {item.icon}
              </span>
              <span style={{ flex: 1 }}>{item.text}</span>
              <ArrowRight size={14} style={{ color: colors.textMuted }} />
            </a>
          ))}
        </div>
      )}

      {attentionItems.length === 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 10,
          background: colors.surface1,
          border: `1px solid ${colors.border}`,
          fontSize: 13,
          color: colors.green,
          marginBottom: 28,
        }}>
          <CheckCircle size={14} />
          No outstanding items
        </div>
      )}

      {/* ─── Build stage progress bar ─── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.gold,
          marginBottom: 12,
        }}>
          Build Progress
        </div>
        <div style={{
          display: 'flex',
          gap: 2,
          marginBottom: 8,
        }}>
          {BUILD_STAGES.map((stage, i) => {
            const isCompleted = i < currentStageIndex;
            const isCurrent = i === currentStageIndex;
            return (
              <div
                key={stage}
                title={STAGE_LABELS[stage]}
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  background: isCompleted
                    ? colors.gold
                    : isCurrent
                      ? colors.gold
                      : colors.border,
                  position: 'relative',
                  overflow: isCurrent ? 'visible' : 'hidden',
                }}
              >
                {isCurrent && (
                  <span style={{
                    position: 'absolute',
                    top: -3,
                    right: -3,
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    background: colors.gold,
                    border: `2px solid ${colors.bg}`,
                    animation: 'builderPulse 2s ease-in-out infinite',
                  }} />
                )}
              </div>
            );
          })}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
        }}>
          <span style={{ color: colors.textSecondary }}>
            Currently: <span style={{ color: colors.gold, fontWeight: 600 }}>{STAGE_LABELS[project.build_stage]}</span>
          </span>
          {nextStage && (
            <span style={{ color: colors.textMuted }}>
              Next: {nextStage}
            </span>
          )}
        </div>
      </div>

      {/* ─── Quick stats row ─── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 12,
        marginBottom: 28,
      }}>
        {[
          { value: handover.days !== null ? Math.abs(handover.days) : '-', label: handover.days !== null && handover.days < 0 ? 'Days overdue' : 'Days to handover' },
          { value: sharedPhotos, label: 'Photos shared' },
          { value: openSnags, label: 'Open snags' },
          { value: totalSelections > 0 ? `${approvedSelections} of ${totalSelections}` : '0', label: 'Selections approved' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: colors.surface1,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              padding: '14px 12px',
              textAlign: 'center',
            }}
          >
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: colors.textPrimary,
              letterSpacing: '-0.03em',
            }}>
              {stat.value}
            </div>
            <div style={{
              fontSize: 11,
              color: colors.textSecondary,
              marginTop: 2,
            }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {/* ─── Upcoming milestones ─── */}
      {upcomingMilestones.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: colors.gold,
            marginBottom: 12,
          }}>
            Upcoming Milestones
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {upcomingMilestones.map((m) => {
              const daysUntil = m.target_date
                ? Math.ceil((new Date(m.target_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              const milestoneColor = daysUntil === null
                ? colors.textMuted
                : daysUntil < 8
                  ? colors.red
                  : daysUntil <= 30
                    ? colors.amber
                    : colors.green;
              return (
                <div
                  key={m.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    borderRadius: 10,
                    background: colors.surface1,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <Calendar size={14} style={{ color: milestoneColor, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: colors.textPrimary }}>
                      {m.label}
                    </div>
                    <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 1 }}>
                      {m.target_date ? new Date(m.target_date).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' }) : 'No date'}
                    </div>
                  </div>
                  {daysUntil !== null && (
                    <span style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: milestoneColor,
                    }}>
                      {daysUntil < 0 ? `${Math.abs(daysUntil)}d overdue` : `${daysUntil}d`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Pulse animation ─── */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes builderPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.3); }
        }
      ` }} />
    </div>
  );
}
