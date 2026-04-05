'use client';

import { useRouter } from 'next/navigation';

const PRODUCTS = [
  {
    id: 'homeowner',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
        <polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
    title: 'My Property',
    subtitle: 'Homeowner portal',
    href: '/login/homeowner',
  },
  {
    id: 'agent',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2"/>
        <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>
        <line x1="12" y1="12" x2="12.01" y2="12"/>
      </svg>
    ),
    title: "I'm an Estate Agent",
    subtitle: 'Sales pipeline & intelligence',
    href: '/login/agent',
  },
  {
    id: 'care',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
      </svg>
    ),
    title: 'My Energy System',
    subtitle: 'Solar, heat pump & EV portal',
    href: '/login/care',
  },
  {
    id: 'developer',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D4AF37" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="8" y1="10" x2="16" y2="10"/>
        <line x1="8" y1="14" x2="12" y2="14"/>
      </svg>
    ),
    title: 'Developer Portal',
    subtitle: 'Project management & analytics',
    href: '/login/developer',
  },
];

export default function LoginSelector() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ backgroundColor: '#050507' }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, #0a0a0f 0%, #050507 70%, #020203 100%)' }} />

      <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\'/%3E%3C/svg%3E")' }} />

      <div className="relative z-10 w-full max-w-[420px] mx-4">
        <div
          className="rounded-2xl p-8 md:p-10 overflow-hidden"
          style={{
            background: 'linear-gradient(180deg, rgba(18, 18, 22, 0.95) 0%, rgba(12, 12, 15, 0.98) 100%)',
            border: '1px solid rgba(212, 175, 55, 0.08)',
            boxShadow: '0 25px 80px -20px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.03)',
          }}
        >
          {/* Logo — same size as developer login */}
          <div className="flex justify-center mb-12">
            <img
              src="/branding/openhouse-ai-logo.png"
              alt="OpenHouse AI"
              className="h-[6.5rem] md:h-32 w-auto object-contain"
            />
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-[1.65rem] font-semibold mb-2" style={{ color: '#f5f5f4' }}>
              Welcome to OpenHouse
            </h1>
            <p className="text-sm tracking-wide" style={{ color: '#6b7280' }}>
              Choose how you use it
            </p>
          </div>

          {/* Product cards */}
          <div className="flex flex-col gap-2.5">
            {PRODUCTS.map(p => (
              <button
                key={p.id}
                onClick={() => router.push(p.href)}
                className="flex items-center gap-4 w-full text-left rounded-[14px] transition-all duration-150"
                style={{
                  padding: '16px 20px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.07)';
                  e.currentTarget.style.borderColor = 'rgba(212,175,55,0.25)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: 'rgba(212, 175, 55, 0.10)',
                  border: '1px solid rgba(212, 175, 55, 0.20)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="font-semibold text-[15px] mb-0.5" style={{ color: '#f5f5f4', letterSpacing: '-0.01em' }}>{p.title}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.35)', margin: 0 }}>{p.subtitle}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round"><polyline points="9,18 15,12 9,6"/></svg>
              </button>
            ))}
          </div>

          <p className="text-center text-xs mt-8 tracking-wide" style={{ color: '#3f3f46' }}>
            OpenHouse AI Property Intelligence Platform
          </p>
        </div>
      </div>
    </div>
  );
}
