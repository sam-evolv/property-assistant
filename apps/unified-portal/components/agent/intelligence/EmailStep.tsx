'use client';
import { useState } from 'react';
import { T } from '@/lib/agent/tokens';
import { Step } from '@/lib/agent/types';
import { GoldButton } from '../ui/GoldButton';
import { GhostButton } from '../ui/GhostButton';
import { BottomSheet } from '../ui/BottomSheet';
import { Mail, Send, Pencil, Check } from 'lucide-react';

export function EmailStep({ step }: { step: Step }) {
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [to, setTo] = useState(step.to || '');
  const [subject, setSubject] = useState(step.subject || '');
  const [body, setBody] = useState(step.body || '');

  return (
    <div style={{ padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: T.infoL, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Mail size={14} color={T.info} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: T.t2 }}>{step.action}</span>
      </div>

      <div style={{
        background: T.s1, border: `1px solid ${T.line}`, borderRadius: 10,
        padding: '10px 12px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t4, textTransform: 'uppercase', marginBottom: 2 }}>
          TO: <span style={{ fontWeight: 500, textTransform: 'none' }}>{to}</span>
        </div>
        <div style={{ fontSize: 9, fontWeight: 700, color: T.t4, textTransform: 'uppercase', marginBottom: 8 }}>
          RE: <span style={{ fontWeight: 500, textTransform: 'none' }}>{subject}</span>
        </div>
        <p style={{ fontSize: 12, color: T.t2, lineHeight: 1.6, margin: 0, whiteSpace: 'pre-line' }}>{body}</p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {sent ? (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', borderRadius: 10,
            background: T.go, color: '#FFFFFF', fontSize: 13, fontWeight: 600,
          }}>
            <Check size={14} /> Sent ✓
          </div>
        ) : (
          <>
            <GoldButton onClick={() => setSent(true)}><Send size={14} /> Send</GoldButton>
            <GhostButton onClick={() => setEditing(true)}><Pencil size={14} /> Edit</GhostButton>
          </>
        )}
      </div>

      <BottomSheet open={editing} onClose={() => setEditing(false)}>
        <h3 style={{ fontSize: 17, fontWeight: 700, color: T.t1, marginBottom: 18 }}>Edit Email</h3>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.t4, marginBottom: 4 }}>To</label>
          <input value={to} onChange={e => setTo(e.target.value)} style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: `1px solid ${T.line}`, background: T.s1, fontSize: 13, color: T.t1,
            outline: 'none', boxSizing: 'border-box',
          }} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.t4, marginBottom: 4 }}>Subject</label>
          <input value={subject} onChange={e => setSubject(e.target.value)} style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            border: `1px solid ${T.line}`, background: T.s1, fontSize: 13, color: T.t1,
            outline: 'none', boxSizing: 'border-box',
          }} />
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: T.t4, marginBottom: 4 }}>Message</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} rows={8} style={{
            width: '100%', padding: '10px 12px', borderRadius: 10, height: 160,
            border: `1px solid ${T.line}`, background: T.s1, fontSize: 13, color: T.t1,
            outline: 'none', resize: 'none', lineHeight: 1.6, boxSizing: 'border-box',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <GhostButton onClick={() => setEditing(false)} style={{ flex: 1 }}>Cancel</GhostButton>
          <GoldButton onClick={() => { setEditing(false); setSent(true); }} style={{ flex: 1 }}><Send size={14} /> Send</GoldButton>
        </div>
      </BottomSheet>
    </div>
  );
}
