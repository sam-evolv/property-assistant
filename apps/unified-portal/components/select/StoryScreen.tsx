'use client';

import { useState, useEffect } from 'react';
import { C, TYPE, RADIUS, SHADOW, EASE, DURATION, KEYFRAMES } from './tokens';

interface StoryScreenProps {
  builderName: string;
  builderPhone: string;
  handoverDate?: string;
}

// Reveal helper
function rv(on: boolean, delay: number, y = 14): React.CSSProperties {
  return {
    opacity: on ? 1 : 0,
    transform: on ? 'translateY(0)' : `translateY(${y}px)`,
    transition: `all ${DURATION.reveal}ms ${EASE}`,
    transitionDelay: on ? `${delay}ms` : '0ms',
  };
}

const STAGES = [
  { date: 'January 2024',  label: 'Site preparation',        done: true,  photos: 3  },
  { date: 'March 2024',    label: 'Foundations poured',      done: true,  photos: 5  },
  { date: 'May 2024',      label: 'Superstructure complete', done: true,  photos: 8  },
  { date: 'June 2024',     label: 'Roof structure on',       done: true,  photos: 4  },
  { date: 'August 2024',   label: 'First fix complete',      done: true,  photos: 6  },
  { date: 'October 2024',  label: 'Second fix & finishes',   done: true,  photos: 11 },
  { date: 'December 2024', label: 'Keys handed over',        done: true,  photos: 7, gold: true },
  { date: 'November 2025', label: 'First annual service',    done: false, upcoming: true },
] as const;

const TOTAL_PHOTOS = STAGES.reduce((s, st) => s + st.photos, 0);

export default function StoryScreen({ builderName, builderPhone }: StoryScreenProps) {
  const [on, setOn] = useState(false);
  useEffect(() => { const id = setTimeout(() => setOn(true), 60); return () => clearTimeout(id); }, []);

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: C.bg, padding: '0 20px 24px',
      fontFamily: '"Inter", system-ui, sans-serif',
    }}>
      <style dangerouslySetInnerHTML={{ __html: KEYFRAMES }} />

      {/* Header */}
      <div style={{ paddingTop: 24, marginBottom: 20 }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 6, ...rv(on, 0) }}>
          Your Journey
        </div>
        <h2 style={{ ...TYPE.heading, color: C.t1, margin: 0, ...rv(on, 100) }}>
          Home Story
        </h2>
        <p style={{ ...TYPE.caption, color: C.t2, marginTop: 4, ...rv(on, 180) }}>
          From groundbreak to forever home · {TOTAL_PHOTOS} photos
        </p>
      </div>

      {/* ── Timeline ── */}
      <div style={{ position: 'relative', paddingLeft: 28 }}>
        {STAGES.map((stage, i) => {
          const isGold = 'gold' in stage && stage.gold;
          const isUpcoming = 'upcoming' in stage && stage.upcoming;
          const delay = 250 + i * 80;

          return (
            <div key={i} style={{
              position: 'relative', paddingBottom: i < STAGES.length - 1 ? 28 : 0,
              ...rv(on, delay),
            }}>
              {/* ── Spine ── */}
              {/* Vertical line */}
              {i < STAGES.length - 1 && (
                <div style={{
                  position: 'absolute', left: -21, top: isGold ? 18 : 14,
                  width: 2, bottom: 0,
                  background: STAGES[i + 1].done || isGold
                    ? `linear-gradient(180deg, ${C.g}80, ${C.g}30)`
                    : C.b1,
                }} />
              )}
              {/* Dot */}
              <div style={{
                position: 'absolute',
                left: isGold ? -28 : -26,
                top: isGold ? 1 : 3,
                width: isGold ? 14 : 10,
                height: isGold ? 14 : 10,
                borderRadius: '50%',
                background: isGold
                  ? `radial-gradient(circle, ${C.gHi}, ${C.g})`
                  : isUpcoming ? 'transparent' : `${C.g}80`,
                border: isUpcoming ? `2px dashed ${C.t3}` : isGold ? 'none' : 'none',
                boxShadow: isGold ? SHADOW.goldGlow : 'none',
              }} />

              {/* ── Content ── */}
              {/* Date */}
              <div style={{
                ...TYPE.caption, color: C.t3,
                textTransform: 'uppercase', fontSize: 10,
                marginBottom: 3,
              }}>
                {stage.date}
              </div>

              {/* Label */}
              <div style={{
                fontSize: 14.5,
                fontWeight: isGold ? 700 : 500,
                color: isGold ? C.g : isUpcoming ? C.t3 : C.t1,
                marginBottom: isGold ? 6 : 8,
              }}>
                {stage.label}
                {isGold && (
                  <span style={{
                    display: 'inline-block', marginLeft: 8,
                    padding: '2px 8px', borderRadius: RADIUS.pill,
                    border: `1px solid ${C.gB}`,
                    ...TYPE.overline, fontSize: 9.5, color: C.g,
                  }}>
                    ✦ Handover
                  </span>
                )}
              </div>

              {/* Photo strip */}
              {stage.done && stage.photos > 0 && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {Array.from({ length: Math.min(stage.photos, 3) }).map((_, j) => (
                    <div key={j} style={{
                      width: 56, height: 42, borderRadius: RADIUS.sm,
                      background: C.s2, border: `1px solid ${C.b1}`,
                    }} />
                  ))}
                  {stage.photos > 3 && (
                    <div style={{
                      width: 56, height: 42, borderRadius: RADIUS.sm,
                      background: C.s2, border: `1px solid ${C.gB}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ ...TYPE.caption, color: C.g }}>+{stage.photos - 3}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Builder card ── */}
      <div style={{
        marginTop: 28, padding: 16, borderRadius: RADIUS.xl,
        background: C.s2, border: `1px solid ${C.gB}`,
        boxShadow: SHADOW.card,
        ...rv(on, 250 + STAGES.length * 80),
      }}>
        <div style={{ ...TYPE.overline, color: C.g, marginBottom: 8 }}>
          Built By
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ ...TYPE.title, color: C.t1, fontSize: 16 }}>{builderName}</div>
            <div style={{ ...TYPE.caption, color: C.t3, marginTop: 2 }}>Cork, Ireland</div>
          </div>
          <div style={{
            ...TYPE.title, color: C.g, fontSize: 13,
          }}>
            {builderPhone}
          </div>
        </div>
      </div>
    </div>
  );
}
