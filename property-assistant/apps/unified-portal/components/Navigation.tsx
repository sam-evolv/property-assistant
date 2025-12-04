'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { logout } from '@/app/actions/auth';

export function Navigation() {
  const pathname = usePathname();
  const auth = useAuth();

  if (!auth.userRole) {
    return null;
  }

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  const isSuperAdmin = auth.userRole === 'super_admin';
  const isAdmin = auth.userRole === 'admin';
  const isDeveloper = auth.userRole === 'developer';

  const links = isSuperAdmin
    ? [
        { href: '/analytics', label: 'Dashboard' },
        { href: '/super', label: 'Super Admin' },
        { href: '/super/analytics', label: 'Super Analytics' },
      ]
    : isAdmin || isDeveloper
    ? [
        { href: '/analytics', label: 'Dashboard' },
        { href: '/developments', label: 'Developments' },
      ]
    : [];

  return (
    <nav className="bg-black shadow-sm border-b border-gold-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold bg-gradient-to-r from-gold-400 to-gold-600 bg-clip-text text-transparent">
                OpenHouse AI
              </h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors ${
                    pathname === link.href
                      ? 'border-gold-500 text-white'
                      : 'border-transparent text-gray-400 hover:border-gold-500/50 hover:text-gray-200'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <span className="text-sm text-gray-300">{auth.email}</span>
              <span className="ml-2 px-2 py-1 text-xs font-medium bg-gold-500/20 text-gold-400 rounded-full border border-gold-500/30">
                {auth.userRole?.replace('_', ' ')}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="px-3 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-gray-800 rounded-md transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
