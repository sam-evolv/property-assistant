'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Mail, Phone, Clock, Star, MessageSquare } from 'lucide-react';
import { colors, EASE, type BuilderProject } from '@/components/select/builder/tokens';

export default function HomeownerTab({ projectId }: { projectId: string }) {
  const supabase = createClientComponentClient();
  const [project, setProject] = useState<BuilderProject | null>(null);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('select_builder_projects')
        .select('*')
        .eq('id', projectId)
        .single();
      if (data) {
        setProject(data);
        setNotes(data.notes || '');
      }
    }
    load();
  }, [supabase, projectId]);

  async function saveNotes() {
    setSaving(true);
    await supabase
      .from('select_builder_projects')
      .update({ notes, updated_at: new Date().toISOString() })
      .eq('id', projectId);
    setSaving(false);
  }

  if (!project) {
    return <div style={{ color: colors.textSecondary, fontSize: 14, padding: 40 }}>Loading...</div>;
  }

  const infoItems = [
    { icon: <Mail size={16} />, label: 'Email', value: project.homeowner_email },
    { icon: <Phone size={16} />, label: 'Phone', value: project.homeowner_phone },
  ].filter((item) => item.value);

  return (
    <div style={{ maxWidth: 600 }}>
      {/* Profile card */}
      <div style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: '24px 20px',
        marginBottom: 20,
      }}>
        {/* Name */}
        <div style={{
          fontSize: 22,
          fontWeight: 700,
          color: colors.textPrimary,
          letterSpacing: '-0.03em',
          marginBottom: 4,
        }}>
          {project.homeowner_name || 'No homeowner assigned'}
        </div>

        {/* Contact info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          {infoItems.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: colors.gold, flexShrink: 0 }}>{item.icon}</span>
              <span style={{ fontSize: 13, color: colors.textSecondary }}>{item.value}</span>
            </div>
          ))}
        </div>

        {/* Last active */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginTop: 16,
          padding: '8px 12px',
          borderRadius: 8,
          background: colors.surface2,
        }}>
          <Clock size={14} color={colors.textMuted} />
          <span style={{ fontSize: 12, color: colors.textMuted }}>
            Not yet activated
          </span>
        </div>

        {/* Satisfaction score — only if complete */}
        {project.status === 'complete' && (
          <div style={{ marginTop: 16 }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: colors.gold,
              marginBottom: 8,
            }}>
              Satisfaction
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Star key={s} size={20} fill={colors.gold} color={colors.gold} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Builder notes */}
      <div style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: '20px',
        marginBottom: 20,
      }}>
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: colors.gold,
          marginBottom: 12,
        }}>
          Builder Notes
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          placeholder="Add notes about this homeowner..."
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
        />
        {saving && (
          <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>Saving...</div>
        )}
      </div>

      {/* Messages placeholder */}
      <div style={{
        background: colors.surface1,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: '40px 20px',
        textAlign: 'center',
      }}>
        <MessageSquare size={32} color={colors.textMuted} style={{ marginBottom: 12 }} />
        <div style={{ fontSize: 15, fontWeight: 600, color: colors.textPrimary, marginBottom: 4 }}>
          In-App Messaging
        </div>
        <div style={{ fontSize: 13, color: colors.textSecondary }}>
          Coming soon — direct messaging with homeowners will appear here.
        </div>
      </div>
    </div>
  );
}
