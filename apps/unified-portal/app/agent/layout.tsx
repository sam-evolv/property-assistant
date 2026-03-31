'use client';
import { usePathname, useRouter } from 'next/navigation';
import { T } from '@/lib/agent/tokens';
import { IntelligenceProvider } from '@/context/IntelligenceContext';
import { Home, LayoutGrid, Zap, FileText, User, Bell } from 'lucide-react';

const TABS = [
  { key: 'home', label: 'Home', href: '/agent/home', icon: Home },
  { key: 'pipeline', label: 'Pipeline', href: '/agent/pipeline', icon: LayoutGrid },
  { key: 'intelligence', label: 'Intelligence', href: '/agent/intelligence', icon: Zap },
  { key: 'docs', label: 'Docs', href: '/agent/docs', icon: FileText },
  { key: 'profile', label: 'Profile', href: '/agent/profile', icon: User },
];

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const activeTab = TABS.find(t => pathname.startsWith(t.href))?.key || 'home';

  return (
    <IntelligenceProvider>
      <div style={{
        maxWidth: 390, margin: '0 auto', height: '100dvh',
        display: 'flex', flexDirection: 'column',
        background: T.bg, fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        {/* Status bar */}
        <div style={{
          height: 50, background: T.card, borderBottom: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', padding: '0 18px',
          flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>9:41</span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', color: T.gold, textTransform: 'uppercase' }}>
              OpenHouse
            </span>
            <span style={{ width: 1, height: 12, background: T.line }} />
            <span style={{ fontSize: 11, fontWeight: 500, letterSpacing: '0.14em', color: T.t4, textTransform: 'uppercase' }}>
              Agent
            </span>
          </div>
          <div style={{ position: 'relative' }}>
            <Bell size={18} color={T.t2} />
            <span style={{
              position: 'absolute', top: -2, right: -2,
              width: 8, height: 8, borderRadius: 4,
              background: T.gold, border: '2px solid white',
            }} />
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto',
          WebkitOverflowScrolling: 'touch',
          msOverflowStyle: 'none',
          scrollbarWidth: 'none',
        }}>
          <style>{`
            div::-webkit-scrollbar { display: none; }
          `}</style>
          {children}
        </div>

        {/* Bottom nav */}
        <div style={{
          height: 62, background: T.card, borderTop: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', flexShrink: 0,
        }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const isIntel = tab.key === 'intelligence';
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => router.push(tab.href)}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                  gap: 2, background: 'none', border: 'none', cursor: 'pointer',
                  position: 'relative', paddingTop: 8, paddingBottom: 4,
                }}
              >
                {/* Active bar */}
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 0,
                    left: '50%', transform: 'translateX(-50%)',
                    width: 14, height: 2,
                    borderRadius: '0 0 2px 2px',
                    background: T.gold,
                  }} />
                )}

                {/* Icon */}
                {isIntel ? (
                  <div style={{
                    width: 36, height: 36, borderRadius: 12,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: isActive ? T.t1 : T.s1,
                    border: isActive ? 'none' : `1px solid ${T.line}`,
                  }}>
                    <Icon size={18} color={isActive ? T.gold : T.t3} />
                  </div>
                ) : (
                  <Icon size={20} color={isActive ? T.t1 : T.t4} />
                )}

                {/* Label */}
                <span style={{
                  fontSize: 9, fontWeight: isActive ? 700 : 400,
                  color: isActive ? T.t1 : T.t4,
                  marginTop: isIntel ? 0 : 2,
                }}>
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </IntelligenceProvider>
  );
}
