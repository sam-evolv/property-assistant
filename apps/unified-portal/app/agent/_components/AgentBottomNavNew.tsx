'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, BarChart3, Calendar, FileText } from 'lucide-react';

export default function AgentBottomNav() {
  const pathname = usePathname();

  const tabs = [
    { id: 'home', label: 'Home', href: '/agent/home?preview=savills', icon: Home },
    { id: 'pipeline', label: 'Pipeline', href: '/agent/pipeline?preview=savills', icon: BarChart3 },
    { id: 'viewings', label: 'Viewings', href: '#', icon: Calendar, disabled: true },
    { id: 'docs', label: 'Docs', href: '#', icon: FileText, disabled: true },
  ];

  const isActive = (id: string) => {
    if (id === 'home') return pathname === '/agent/home' || pathname === '/agent';
    if (id === 'pipeline') return pathname.startsWith('/agent/pipeline') || pathname.startsWith('/agent/solicitors');
    return false;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-[76px] bg-[#FAFAF8]/92 backdrop-blur-xl border-t border-black/[0.08] flex items-end z-50"
         style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
      {tabs.map((tab) => {
        const active = isActive(tab.id);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.id}
            href={tab.disabled ? '#' : tab.href}
            className={`flex-1 flex flex-col items-center gap-1 relative transition-all duration-150 ${tab.disabled ? 'opacity-40 pointer-events-none' : 'active:scale-[0.95]'}`}
            style={{ minHeight: 44 }}
          >
            {active && (
              <div className="absolute -top-3 w-5 h-0.5 rounded-b bg-gradient-to-r from-[#B8960C] to-[#E8C84A]" />
            )}
            <Icon size={22} className={active ? 'text-gray-900' : 'text-gray-300'} strokeWidth={1.6} />
            <span className={`text-[9.5px] ${active ? 'font-semibold text-gray-900' : 'font-medium text-gray-300'}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
