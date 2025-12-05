'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Building2, 
  Home, 
  Users, 
  FileText, 
  Database, 
  MessageSquare, 
  FileWarning, 
  Activity, 
  UserCog,
  Upload,
  BarChart3,
  Search,
  ChevronRight,
  Smartphone
} from 'lucide-react';
import { DevelopmentSwitcher } from '@/components/developer/DevelopmentSwitcher';

interface MenuItem {
  href: string;
  label: string;
  icon: any;
  section?: string;
}

const menuSections = [
  {
    label: 'Analytics',
    items: [
      { href: '/super', label: 'Overview', icon: LayoutDashboard },
      { href: '/super/analytics', label: 'Platform Analytics', icon: Activity },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/super/developers', label: 'Developers', icon: UserCog },
      { href: '/super/developments', label: 'Developments', icon: Building2 },
      { href: '/super/units', label: 'Units', icon: Home },
      { href: '/super/homeowners', label: 'Homeowners', icon: Users },
      { href: '/super/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/super/system-logs', label: 'System Logs', icon: FileWarning },
      { href: '/super/training-jobs', label: 'Training Jobs', icon: Upload },
    ],
  },
  {
    label: 'Quick Access',
    items: [
      { href: '/developer', label: 'Developer Dashboard', icon: BarChart3 },
      { href: '/super/purchaser-demo?unitUid=LV-PARK-003', label: 'Purchaser Portal Demo', icon: Smartphone },
    ],
  },
];

export function AdminEnterpriseNav() {
  const pathname = usePathname();

  return (
    <nav className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-900">OpenHouse AI</h1>
        <p className="text-sm text-gray-500 mt-1">Enterprise Admin</p>
      </div>
      
      {/* Development Switcher */}
      <DevelopmentSwitcher />
      
      <div className="flex-1 overflow-y-auto py-4">
        {menuSections.map((section) => (
          <div key={section.label} className="mb-6">
            <div className="px-6 mb-2">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {section.label}
              </h3>
            </div>
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || 
                (item.href !== '/super' && pathname?.startsWith(item.href));
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between gap-3 px-6 py-2.5 text-sm transition-all duration-premium group ${
                    isActive
                      ? 'bg-gold-50 text-gold-700 font-semibold border-r-4 border-gold-500'
                      : 'text-gray-700 hover:bg-gold-50/50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-gold-600' : 'text-gray-400 group-hover:text-gold-500'}`} />
                    <span>{item.label}</span>
                  </div>
                  {isActive && <ChevronRight className="w-4 h-4 text-gold-600" />}
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-gold-100">
        <div className="text-xs text-gray-500 text-center">
          <p className="font-medium text-gray-700">OpenHouse AI Enterprise</p>
          <p className="mt-1 text-gold-600 font-medium">Phase 16: Premium Polish</p>
        </div>
      </div>
    </nav>
  );
}
