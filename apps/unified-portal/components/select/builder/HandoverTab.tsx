'use client';

import { useState, useEffect, useMemo } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CheckCircle, Circle, AlertTriangle, Key } from 'lucide-react';
import {
  colors, EASE, BUILD_STAGES, type BuilderProject,
} from '@/components/select/builder/tokens';

interface ChecklistItem {
  label: string;
  met: boolean;
  blocking: boolean;
}

export default function HandoverTab({ projectId }: { projectId: string }) {
  const supabase = createClientComponentClient();
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [hasBer, setHasBer] = useState(false);
  const [hasHomebond, setHasHomebond] = useState(false);
  const [hasBcar, setHasBcar] = useState(false);
  const [hasStructural, setHasStructural] = useState(false);
  const [allSelectionsFinalized, setAllSelectionsFinalized] = useState(false);
  const [openSnags, setOpenSnags] = useState(0);
  const [welcomeNote, setWelcomeNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [initiating, setInitiating] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: proj } = await supabase
        .from('select_builder_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (proj) setProject(proj);

      // Check documents
      const { data: docs } = await supabase
        .from('select_project_documents')
        .select('category')
        .eq('project_id', projectId);

      if (docs) {
        const cats = docs.map((d) => d.category);
        setHasBer(cats.includes('ber'));
        setHasHomebond(cats.includes('homebond'));
        setHasBcar(cats.includes('bcar'));
        setHasStructural(cats.includes('structural'));
      }

      // Check selections
      const { data: selections } = await supabase
        .from('select_project_selections')
        .select('status')
        .eq('project_id', projectId);
      if (selections) {
        setAllSelectionsFinalized(
          selections.length === 0 || selections.every((s) => s.status === 'finalised' || s.status === 'approved')
        );
      }

      // Check snags
      const { data: snags } = await supabase
        .from('select_project_snags')
        .select('id')
        .eq('project_id', projectId)
        .in('status', ['open', 'in_progress']);
      if (snags) setOpenSnags(snags.length);
    }
    load();
  }, [supabase, projectId]);

  const allStagesComplete = useMemo(() => {
    if (!project) return false;
    const idx = BUILD_STAGES.indexOf(project.build_stage as typeof BUILD_STAGES[number]);
    return idx >= BUILD_STAGES.length - 1;
  }, [project]);

  const checklist = useMemo<ChecklistItem[]>(() => {
    if (!project) return [];
    return [
      { label: 'All build stages marked complete', met: allStagesComplete, blocking: true },
      { label: 'BER certificate uploaded', met: hasBer, blocking: true },
      { label: 'HomeBond certificate uploaded', met: hasHomebond, blocking: true },
      { label: 'BCAR uploaded', met: hasBcar, blocking: true },
      { label: 'All selections finalised', met: allSelectionsFinalized, blocking: false },
      { label: `All snags resolved (${openSnags} open)`, met: openSnags === 0, blocking: true },
      { label: 'Structural certs uploaded', met: hasStructural, blocking: false },
      { label: 'Handover date set', met: !!project.target_handover_date, blocking: true },
    ];
  }, [project, allStagesComplete, hasBer, hasHomebond, hasBcar, hasStructural, allSelectionsFinalized, openSnags]);

  const allBlockingMet = checklist.filter((c) => c.blocking).every((c) => c.met);

  const isSnaggingOrLater = useMemo(() => {
    if (!project) return false;
    const idx = BUILD_STAGES.indexOf(project.build_stage as typeof BUILD_STAGES[number]);
    const snaggingIdx = BUILD_STAGES.indexOf('snagging');
    return idx >= snaggingIdx;
  }, [project]);

  async function initiateHandover() {
    if (!project || !allBlockingMet) return;
    const confirmed = window.confirm(
      `Initiate handover for ${project.address_line_1 || project.address}? This will notify ${project.homeowner_name || 'the homeowner'} and activate their homeowner portal.`
    );
    if (!confirmed) return;

    setInitiating(true);
    await supabase
      .from('select_builder_projects')
      .update({
        actual_handover_date: new Date().toISOString().split('T')[0],
        status: 'complete',
        build_stage: 'complete',
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    setInitiating(false);
    window.location.href = '/builder';
  }

  if (!project) {
    return <div style={{ color: colors.textSecondary, fontSize: 14, padding: 40 }}>Loading...</div>;
  }

  if (!isSnaggingOrLater) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 24px',
        textAlign: 'center',
      }}>
        <Key size={40} color={colors.textMuted} />
        <div style={{ fontSize: 16, fontWeight: 600, color: colors.textPrimary, marginTop: 16 }}>
          Handover Not Available Yet
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4, maxWidth: 320 }}>
          The handover checklist becomes available when the build reaches the snagging stage or later.
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        color: colors.gold,
        marginBottom: 16,
      }}>
        Handover Readiness
      </div>

      {/* Checklist */}
      <div style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 24,
      }}>
        {checklist.map((item, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderBottom: i < checklist.length - 1 ? `1px solid ${colors.border}` : 'none',
            }}
          >
            {item.met ? (
              <CheckCircle size={18} color={colors.green} />
            ) : item.blocking ? (
              <AlertTriangle size={18} color={colors.red} />
            ) : (
              <Circle size={18} color={colors.amber} />
            )}
            <span style={{
              fontSize: 13,
              color: item.met ? colors.textSecondary : colors.textPrimary,
              fontWeight: item.met ? 400 : 500,
            }}>
              {item.label}
            </span>
          </div>
        ))}
      </div>

      {/* Welcome note */}
      <div style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.gold,
          marginBottom: 8,
        }}>
          Welcome Message
        </div>
        <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
          Write a message to {project.homeowner_name || 'the homeowner'} — it will appear in their app at handover.
        </div>
        <textarea
          value={welcomeNote}
          onChange={(e) => {
            if (e.target.value.length <= 500) setWelcomeNote(e.target.value);
          }}
          placeholder={`Congratulations on your new home, ${project.homeowner_name?.split(' ')[0] || ''}...`}
          rows={4}
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 8,
            background: colors.surface2,
            border: `1px solid ${colors.border}`,
            color: colors.textPrimary,
            fontSize: 13,
            lineHeight: 1.6,
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            transition: `border-color 200ms ${EASE}`,
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'rgba(212,175,55,0.4)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = colors.border; }}
        />
        <div style={{
          fontSize: 11,
          color: colors.textMuted,
          textAlign: 'right',
          marginTop: 4,
        }}>
          {welcomeNote.length}/500
        </div>
      </div>

      {/* Initiate handover button */}
      <button
        onClick={initiateHandover}
        disabled={!allBlockingMet || initiating}
        style={{
          width: '100%',
          padding: '14px 20px',
          borderRadius: 12,
          background: allBlockingMet ? colors.gold : colors.surface3,
          color: allBlockingMet ? colors.bg : colors.textMuted,
          fontWeight: 700,
          fontSize: 15,
          border: 'none',
          cursor: allBlockingMet ? 'pointer' : 'not-allowed',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          transition: `all 200ms ${EASE}`,
          opacity: initiating ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (allBlockingMet) e.currentTarget.style.filter = 'brightness(1.08)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = 'brightness(1)';
        }}
      >
        <Key size={18} />
        {initiating ? 'Initiating...' : 'Initiate Handover'}
      </button>

      {!allBlockingMet && (
        <div style={{
          fontSize: 12,
          color: colors.textMuted,
          textAlign: 'center',
          marginTop: 8,
        }}>
          Resolve all blocking items above to enable handover.
        </div>
      )}
    </div>
  );
}
