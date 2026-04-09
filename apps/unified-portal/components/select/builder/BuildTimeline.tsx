'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Check, Circle, Calendar } from 'lucide-react';
import {
  colors,
  EASE,
  STAGE_LABELS,
  BUILD_STAGES,
  type BuilderProject,
} from '@/components/select/builder/tokens';

interface Milestone {
  id: string;
  stage: string;
  label: string;
  target_date: string | null;
  completed_at: string | null;
  sort_order: number;
}

interface BuildTimelineProps {
  projectId: string;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IE', {
    day: 'numeric',
    month: 'short',
  });
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(a);
  const d2 = new Date(b);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return Math.ceil(Math.abs(d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function daysFromNow(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export default function BuildTimeline({ projectId }: BuildTimelineProps) {
  const supabase = createClientComponentClient();

  const [project, setProject] = useState<BuilderProject | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [hoveredButton, setHoveredButton] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: proj }, { data: ms }] = await Promise.all([
      supabase
        .from('select_builder_projects')
        .select('*')
        .eq('id', projectId)
        .single(),
      supabase
        .from('select_project_milestones')
        .select('*')
        .eq('project_id', projectId)
        .order('sort_order', { ascending: true }),
    ]);

    if (proj) setProject(proj);
    if (ms) setMilestones(ms);
    setLoading(false);
  }, [supabase, projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const currentStageIndex = useMemo(() => {
    if (!project) return -1;
    return BUILD_STAGES.indexOf(project.build_stage as typeof BUILD_STAGES[number]);
  }, [project]);

  const getMilestoneForStage = useCallback(
    (stage: string): Milestone | undefined => {
      return milestones.find((m) => m.stage === stage);
    },
    [milestones],
  );

  const handleMarkComplete = useCallback(
    async (stage: string) => {
      if (!project) return;
      const label = STAGE_LABELS[stage] || stage;
      const confirmed = window.confirm(
        `Mark ${label} as complete? The homeowner will be notified.`,
      );
      if (!confirmed) return;

      setCompleting(true);

      const stageIndex = BUILD_STAGES.indexOf(stage as typeof BUILD_STAGES[number]);
      const nextStage =
        stageIndex < BUILD_STAGES.length - 1
          ? BUILD_STAGES[stageIndex + 1]
          : BUILD_STAGES[stageIndex];

      // Insert completed milestone if one does not already exist
      const existing = getMilestoneForStage(stage);
      if (existing && !existing.completed_at) {
        await supabase
          .from('select_project_milestones')
          .update({ completed_at: new Date().toISOString() })
          .eq('id', existing.id);
      } else if (!existing) {
        await supabase.from('select_project_milestones').insert({
          project_id: projectId,
          stage,
          label: STAGE_LABELS[stage] || stage,
          completed_at: new Date().toISOString(),
          sort_order: stageIndex,
        });
      }

      // Advance project to next stage
      await supabase
        .from('select_builder_projects')
        .update({ build_stage: nextStage })
        .eq('id', projectId);

      await loadData();
      setCompleting(false);
    },
    [project, supabase, projectId, getMilestoneForStage, loadData],
  );

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
    <div style={{ maxWidth: 640 }}>
      {/* Header */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.gold,
          marginBottom: 20,
        }}
      >
        Build Timeline
      </div>

      {/* Timeline */}
      <div style={{ position: 'relative' }}>
        {BUILD_STAGES.map((stage, i) => {
          const isCompleted = i < currentStageIndex;
          const isCurrent = i === currentStageIndex;
          const isUpcoming = i > currentStageIndex;
          const isLast = i === BUILD_STAGES.length - 1;

          const milestone = getMilestoneForStage(stage);
          const targetDate = milestone?.target_date || null;
          const completedAt = milestone?.completed_at || null;

          // For completed stages, try to derive start date from previous milestone
          const prevMilestone =
            i > 0 ? getMilestoneForStage(BUILD_STAGES[i - 1]) : null;
          const startedDate = prevMilestone?.completed_at || null;

          const durationDays =
            isCompleted && startedDate && completedAt
              ? daysBetween(startedDate, completedAt)
              : null;

          const daysRemaining =
            isCurrent && targetDate ? daysFromNow(targetDate) : null;

          return (
            <div
              key={stage}
              style={{
                display: 'flex',
                gap: 16,
                position: 'relative',
                minHeight: isCurrent ? 90 : 56,
              }}
            >
              {/* Connector column */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 20,
                  flexShrink: 0,
                }}
              >
                {/* Dot */}
                {isCompleted ? (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: colors.gold,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                ) : isCurrent ? (
                  <div
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: colors.gold,
                      flexShrink: 0,
                      marginTop: 3,
                      boxShadow: `0 0 8px ${colors.goldGlow}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: 'transparent',
                      border: `2px solid ${colors.border}`,
                      flexShrink: 0,
                      marginTop: 4,
                    }}
                  />
                )}

                {/* Connector line */}
                {!isLast && (
                  <div
                    style={{
                      flex: 1,
                      width: 0,
                      borderLeft: isCompleted
                        ? `2px solid ${colors.gold}`
                        : `2px dashed ${colors.border}`,
                      marginTop: 4,
                    }}
                  />
                )}
              </div>

              {/* Content row */}
              <div
                style={{
                  flex: 1,
                  paddingBottom: isLast ? 0 : 16,
                  borderLeft: isCurrent
                    ? `3px solid ${colors.gold}`
                    : '3px solid transparent',
                  paddingLeft: isCurrent ? 12 : 0,
                  marginLeft: isCurrent ? -4 : 0,
                }}
              >
                {/* Top row: stage name + right-aligned info */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: isCompleted ? 600 : isCurrent ? 700 : 400,
                        color: isCompleted
                          ? colors.textPrimary
                          : isCurrent
                            ? colors.gold
                            : colors.textSecondary,
                      }}
                    >
                      {STAGE_LABELS[stage]}
                    </span>
                    {isCurrent && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 700,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase',
                          color: colors.gold,
                        }}
                      >
                        ← Current
                      </span>
                    )}
                  </div>

                  {/* Right side: completion info */}
                  {isCompleted && completedAt && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        flexShrink: 0,
                      }}
                    >
                      <Check size={12} style={{ color: colors.green }} />
                      <span
                        style={{
                          fontSize: 12,
                          color: colors.green,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Completed {formatDate(completedAt)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Subtitle line for completed stages */}
                {isCompleted && startedDate && (
                  <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>
                    Started {formatDate(startedDate)}
                    {durationDays !== null && ` \u00B7 Took ${durationDays} days`}
                  </div>
                )}

                {/* Current stage details */}
                {isCurrent && (
                  <div style={{ marginTop: 6 }}>
                    {targetDate ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Calendar size={12} style={{ color: colors.textMuted }} />
                        Target: {formatDate(targetDate)}
                        {daysRemaining !== null && (
                          <span
                            style={{
                              color:
                                daysRemaining < 0
                                  ? colors.red
                                  : daysRemaining < 8
                                    ? colors.amber
                                    : colors.textSecondary,
                            }}
                          >
                            {' '}&middot;{' '}
                            {daysRemaining < 0
                              ? `${Math.abs(daysRemaining)} days overdue`
                              : `${daysRemaining} days remaining`}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: colors.textMuted }}>
                        No target date set
                      </div>
                    )}

                    {/* Mark Complete button */}
                    <button
                      disabled={completing}
                      onClick={() => handleMarkComplete(stage)}
                      onMouseEnter={() => setHoveredButton(stage)}
                      onMouseLeave={() => setHoveredButton(null)}
                      style={{
                        marginTop: 10,
                        height: 32,
                        padding: '0 14px',
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 600,
                        border: 'none',
                        cursor: completing ? 'not-allowed' : 'pointer',
                        background:
                          hoveredButton === stage
                            ? '#c9a430'
                            : colors.gold,
                        color: colors.bg,
                        opacity: completing ? 0.6 : 1,
                        transition: `all 200ms ${EASE}`,
                      }}
                    >
                      {completing ? 'Updating...' : 'Mark Complete'}
                    </button>
                  </div>
                )}

                {/* Upcoming stage details */}
                {isUpcoming && (
                  <div style={{ marginTop: 2 }}>
                    {targetDate ? (
                      <div
                        style={{
                          fontSize: 12,
                          color: colors.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Calendar size={12} style={{ color: colors.textMuted }} />
                        Target: {formatDate(targetDate)}
                      </div>
                    ) : (
                      <div style={{ fontSize: 12, color: colors.textMuted }}>
                        No date set
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
