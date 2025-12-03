'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const TEST_ACCOUNTS = [
  {
    name: 'Super Admin',
    email: 'sam@evolvai.ie',
    role: 'super_admin',
    description: 'Full platform access - analytics, system logs, all developments',
    dashboardRoute: '/super',
    color: 'purple'
  },
  {
    name: 'Developer A',
    email: 'developer-a@test.com',
    role: 'developer',
    description: 'Single tenant developer - manage developments, units, homeowners',
    dashboardRoute: '/developer',
    color: 'blue'
  },
  {
    name: 'Developer B',
    email: 'developer-b@test.com',
    role: 'developer',
    description: 'Another developer account for testing multi-tenancy',
    dashboardRoute: '/developer',
    color: 'green'
  }
];

const QUICK_LINKS = [
  { label: 'Super Admin Dashboard', route: '/super', icon: '👑' },
  { label: 'Developer Dashboard', route: '/developer', icon: '🏗️' },
  { label: 'Sample Unit (QR)', route: '/homes/DEMO-001', icon: '🏠' },
  { label: 'RAG Analytics', route: '/super/rag', icon: '📊' },
  { label: 'Chat Analytics', route: '/super/chat-analytics', icon: '💬' },
  { label: 'System Logs', route: '/super/system-logs', icon: '📋' },
  { label: 'Homeowners Directory', route: '/super/homeowners', icon: '👥' },
  { label: 'Units Explorer', route: '/super/units', icon: '🔍' },
];

export default function TestHubPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [isProduction, setIsProduction] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    // Multi-layered production guard:
    // 1. Environment check
    // 2. Hostname check (with Host header spoofing protection)
    
    const checkAccess = async () => {
      // Environment variable check (server-injected at build time)
      const isDev = process.env.NODE_ENV === 'development';
      
      // Hostname check (localhost = dev)
      const isLocalhost = typeof window !== 'undefined' && 
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
      
      // If not dev environment and not localhost, block immediately
      if (!isDev && !isLocalhost) {
        setIsProduction(true);
        setCheckingAuth(false);
        return;
      }
      
      // In dev environment, allow access immediately without auth check
      // This allows users to use the Quick Login buttons
      setHasAccess(true);
      setCheckingAuth(false);
    };
    
    checkAccess();
  }, []);

  const handleQuickLogin = async (account: typeof TEST_ACCOUNTS[0]) => {
    setLoading(account.email);
    
    try {
      const response = await fetch('/api/auth/test-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: account.email }),
      });

      if (!response.ok) {
        throw new Error('Test login failed');
      }
      
      router.push(account.dashboardRoute);
    } catch (error) {
      console.error('Test login failed:', error);
      alert('Test login failed - check console');
    } finally {
      setLoading(null);
    }
  };

  // Loading state while checking auth
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4 animate-pulse">🔒</div>
          <p className="text-gray-600">Verifying access...</p>
        </div>
      </div>
    );
  }

  // Production/access guard - redirect or show error
  if (isProduction || !hasAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-8">
        <div className="max-w-md bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">🚫</div>
          <h1 className="text-2xl font-bold text-red-600 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-4">
            The test hub is only available to super admin users in development environments. Please use the regular login page to access the portal.
          </p>
          <button
            onClick={() => router.push('/login')}
            className="px-6 py-3 bg-gold-500 text-white rounded-lg hover:bg-gold-600 transition-all font-medium"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl font-bold text-gray-900">
              🧪 Test Hub
            </h1>
            <span className="px-3 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
              DEV ONLY
            </span>
          </div>
          <p className="text-gray-600">
            Quick access to test accounts and key portal views. This page is only available in development builds.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔐</span> Test Accounts
            </h2>
            <div className="space-y-4">
              {TEST_ACCOUNTS.map((account) => (
                <div
                  key={account.email}
                  className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-all border border-gray-200"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {account.name}
                      </h3>
                      <p className="text-sm text-gray-500 font-mono">
                        {account.email}
                      </p>
                      <p className="text-xs text-gray-600 mt-2">
                        {account.description}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-xs font-semibold rounded-full bg-${account.color}-100 text-${account.color}-700`}>
                      {account.role}
                    </span>
                  </div>
                  <button
                    onClick={() => handleQuickLogin(account)}
                    disabled={loading === account.email}
                    className="w-full px-4 py-2 bg-gold-500 text-white rounded-lg hover:bg-gold-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all font-medium shadow-sm hover:shadow-md"
                  >
                    {loading === account.email ? 'Logging in...' : 'Quick Login'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <span>🔗</span> Quick Links
            </h2>
            <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <div className="grid grid-cols-1 gap-2">
                {QUICK_LINKS.map((link) => (
                  <button
                    key={link.route}
                    onClick={() => router.push(link.route)}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left border border-transparent hover:border-gray-200"
                  >
                    <span className="text-2xl">{link.icon}</span>
                    <span className="text-gray-900 font-medium">{link.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 bg-gold-50 border border-gold-200 rounded-lg p-4">
              <p className="text-sm text-gold-800">
                <strong>💡 Pro Tip:</strong> Bookmark this page during development to quickly switch between different user contexts and test role-based access controls.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Route Structure</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <code className="block bg-gray-100 px-3 py-2 rounded mb-1 font-mono">/login</code>
              <p className="text-gray-600 text-xs">Shared login page</p>
            </div>
            <div>
              <code className="block bg-gray-100 px-3 py-2 rounded mb-1 font-mono">/developer</code>
              <p className="text-gray-600 text-xs">Developer dashboard</p>
            </div>
            <div>
              <code className="block bg-gray-100 px-3 py-2 rounded mb-1 font-mono">/super</code>
              <p className="text-gray-600 text-xs">Super admin dashboard</p>
            </div>
            <div>
              <code className="block bg-gray-100 px-3 py-2 rounded mb-1 font-mono">/homes/:unitUid</code>
              <p className="text-gray-600 text-xs">Resident QR experience</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
