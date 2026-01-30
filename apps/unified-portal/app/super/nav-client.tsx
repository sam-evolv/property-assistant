'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  Home, 
  Users, 
  FileText, 
  FileWarning, 
  Activity, 
  UserCog,
  Upload,
  BarChart3,
  Smartphone,
  FolderPlus,
  Layers,
  Zap,
  HeartPulse,
  Menu,
  X,
  Ticket,
  Brain,
  TrendingUp,
} from 'lucide-react';
import { ProjectSwitcher } from '@/components/developer/ProjectSwitcher';

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
      { href: '/super/beta-control-room', label: 'Beta Control Room', icon: Zap },
      { href: '/super/analytics', label: 'Platform Analytics', icon: Activity },
    ],
  },
  {
    label: 'Project Setup',
    items: [
      { href: '/super/projects/new', label: 'New Project', icon: FolderPlus },
    ],
  },
  {
    label: 'Management',
    items: [
      { href: '/super/tenants', label: 'Tenants', icon: Building2 },
      { href: '/super/developers', label: 'Developers', icon: UserCog },
      { href: '/super/developer-codes', label: 'Invitation Codes', icon: Ticket },
      { href: '/super/onboarding-submissions', label: 'Onboarding Submissions', icon: FolderPlus },
      { href: '/super/developments', label: 'Developments', icon: Layers },
      { href: '/super/units', label: 'Units', icon: Home },
      { href: '/super/homeowners', label: 'Homeowners', icon: Users },
      { href: '/super/documents', label: 'Documents', icon: FileText },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      { href: '/super/assistant-training', label: 'Assistant Training', icon: Brain },
      { href: '/super/rd-analytics', label: 'R&D Analytics', icon: TrendingUp },
    ],
  },
  {
    label: 'System',
    items: [
      { href: '/super/system-health', label: 'System Health', icon: HeartPulse },
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

  const isActive = (href: string) => {
    if (href === '/super') {
      return pathname === '/super';
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:flex flex-col w-64 bg-black border-r border-gold-900/20">
        {/* Header with Logo */}
        <div className="p-6 border-b border-gold-900/20 flex items-center justify-center">
          <Image
            src="/branding/openhouse-logo.png"
            alt="OpenHouse AI"
            width={220}
            height={80}
            className="h-20 w-auto object-contain"
            priority
          />
        </div>
        
        {/* Project Switcher */}
        <ProjectSwitcher />
        
        {/* Navigation */}
        <div className="flex-1 overflow-y-auto py-6 px-3 space-y-8 scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {menuSections.map((section) => (
            <div key={section.label}>
              <p className="px-4 py-2 text-xs font-semibold text-grey-500 uppercase tracking-wider">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);
                  
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all text-sm font-medium ${
                        active
                          ? 'bg-gold-500 text-white shadow-lg'
                          : 'text-grey-400 hover:bg-gold-500/10 hover:text-gold-300'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gold-900/20">
          <div className="px-4 py-2 text-xs text-grey-600 text-center">
            <p className="font-medium text-grey-500">OpenHouse AI Enterprise</p>
            <p className="text-grey-600 mt-0.5">v1.0.0</p>
          </div>
        </div>
      </nav>
    </>
  );
}

export function SuperMobileNav() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/super') {
      return pathname === '/super';
    }
    return pathname?.startsWith(href);
  };

  return (
    <>
      {/* Mobile Header - sticky for accessibility */}
      <div className="md:hidden sticky top-0 z-50 border-b border-gold-200/30 px-4 py-4 flex items-center justify-between bg-black">
        <div className="flex items-center gap-2">
          <Image
            src="/branding/openhouse-logo.png"
            alt="OpenHouse AI"
            width={120}
            height={40}
            className="h-8 w-auto object-contain"
            priority
          />
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 hover:bg-gold-500/10 rounded-lg transition"
        >
          {mobileMenuOpen ? (
            <X className="w-5 h-5 text-gold-400" />
          ) : (
            <Menu className="w-5 h-5 text-gold-400" />
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-gold-200/30 bg-black/95 backdrop-blur-sm px-4 py-4 space-y-6 overflow-y-auto">
          {menuSections.map((section) => (
            <div key={section.label}>
              <p className="px-2 py-1.5 text-xs font-semibold text-grey-500 uppercase tracking-wider mb-2">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActive(item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all text-sm font-medium ${
                        active
                          ? 'bg-gold-500 text-white'
                          : 'text-grey-400 hover:bg-gold-500/10 hover:text-gold-300'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
