'use client';

import { useEffect, useState } from 'react';
import { Users, MessageSquare, Activity, CheckCircle2 } from 'lucide-react';
import { InsightCard } from '@/components/admin-enterprise/InsightCard';
import { SectionHeader } from '@/components/admin-enterprise/SectionHeader';
import { TableSkeleton } from '@/components/admin-enterprise/LoadingSkeleton';
import { DataTable, Column } from '@/components/admin-enterprise/DataTable';

interface Homeowner {
  id: string;
  name: string;
  email: string;
  house_type: string | null;
  address: string | null;
  development_name: string | null;
  development_id: string | null;
  created_at: string;
  chat_message_count: number;
  last_active: string | null;
  registered_at: string | null;
  important_docs_agreed_version: number;
  important_docs_agreed_at: string | null;
  is_registered: boolean;
}

export function HomeownersDirectory() {
  const [homeowners, setHomeowners] = useState<Homeowner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/admin/homeowners/stats')
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch homeowners');
        return res.json();
      })
      .then((data) => setHomeowners(data.homeowners || []))
      .catch((err) => {
        console.error('Homeowners error:', err);
        setError(err.message);
      })
      .finally(() => setLoading(false));
  }, []);

  const getActivityStatus = (lastActive: string | null) => {
    if (!lastActive) return { label: 'Never', color: 'text-gray-400' };
    
    const daysSince = Math.floor(
      (Date.now() - new Date(lastActive).getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSince === 0) return { label: 'Today', color: 'text-green-600' };
    if (daysSince <= 7) return { label: `${daysSince}d ago`, color: 'text-green-500' };
    if (daysSince <= 30) return { label: `${daysSince}d ago`, color: 'text-gold-600' };
    return { label: `${daysSince}d ago`, color: 'text-gray-500' };
  };

  if (loading) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <SectionHeader title="Homeowner Directory" description="Loading..." />
        <TableSkeleton rows={8} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 bg-gray-50 min-h-screen">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium">Failed to load homeowners</p>
          <p className="text-red-500 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  const columns: Column<Homeowner>[] = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            item.is_registered ? 'bg-gold-100' : 'bg-gray-100'
          }`}>
            <span className={`font-semibold text-sm ${
              item.is_registered ? 'text-gold-700' : 'text-gray-500'
            }`}>
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-semibold text-gray-900">{item.name}</p>
            <p className="text-xs text-gray-500">{item.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'house_type',
      label: 'House Type',
      sortable: true,
      render: (item) =>
        item.house_type ? (
          <span className="px-2 py-1 bg-gold-100 text-gold-700 rounded text-xs font-medium">
            {item.house_type}
          </span>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        ),
    },
    {
      key: 'development_name',
      label: 'Development',
      sortable: true,
      render: (item) => (
        <span className="text-gray-700">{item.development_name || '-'}</span>
      ),
    },
    {
      key: 'chat_message_count',
      label: 'Chats',
      sortable: true,
      render: (item) => (
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gold-600" />
          <span className="font-semibold text-gray-900">{item.chat_message_count}</span>
        </div>
      ),
    },
    {
      key: 'important_docs_agreed_version',
      label: 'Important Docs',
      sortable: true,
      render: (item) => {
        if (!item.is_registered) {
          return (
            <span className="px-2 py-1 bg-gray-100 text-gray-500 rounded text-xs font-medium">
              Not Registered
            </span>
          );
        }
        if (item.important_docs_agreed_version > 0 && item.important_docs_agreed_at) {
          return (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs font-medium text-green-700">
                  Agreed v{item.important_docs_agreed_version}
                </span>
              </div>
              <span className="text-xs text-gray-500">
                {new Date(item.important_docs_agreed_at).toLocaleDateString()}
              </span>
            </div>
          );
        }
        return (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
            Pending
          </span>
        );
      },
    },
    {
      key: 'last_active',
      label: 'Activity',
      sortable: true,
      render: (item) => {
        const status = getActivityStatus(item.last_active);
        return (
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${status.color}`} />
            <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
          </div>
        );
      },
    },
    {
      key: 'created_at',
      label: 'Registered',
      sortable: true,
      render: (item) => (
        <span className="text-gray-600 text-sm">
          {item.registered_at 
            ? new Date(item.registered_at).toLocaleDateString()
            : <span className="text-gray-400 italic">Not yet</span>
          }
        </span>
      ),
    },
  ];

  const activeHomeowners = homeowners.filter((h) => {
    if (!h.last_active) return false;
    const daysSince = Math.floor(
      (Date.now() - new Date(h.last_active).getTime()) / (1000 * 60 * 60 * 24)
    );
    return daysSince <= 7;
  });

  const registeredHomeowners = homeowners.filter(h => h.is_registered);
  const agreedToImportantDocs = homeowners.filter(h => h.important_docs_agreed_version > 0);

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <SectionHeader
        title="Homeowner Directory"
        description={`${homeowners.length} total units • ${registeredHomeowners.length} registered`}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <InsightCard
          title="Total Units"
          value={homeowners.length}
          subtitle={`${registeredHomeowners.length} registered (${Math.round((registeredHomeowners.length / homeowners.length) * 100) || 0}%)`}
          icon={<Users className="w-5 h-5" />}
        />
        <InsightCard
          title="Active (7 days)"
          value={activeHomeowners.length}
          subtitle={`${Math.round((activeHomeowners.length / registeredHomeowners.length) * 100) || 0}% activity rate`}
          icon={<Activity className="w-5 h-5" />}
        />
        <InsightCard
          title="Important Docs Agreed"
          value={agreedToImportantDocs.length}
          subtitle={`${Math.round((agreedToImportantDocs.length / registeredHomeowners.length) * 100) || 0}% of registered`}
          icon={<CheckCircle2 className="w-5 h-5" />}
        />
      </div>

      <DataTable
        data={homeowners}
        columns={columns}
        searchable={true}
        searchPlaceholder="Search by name, email, development..."
        emptyMessage="No homeowners found"
      />
    </div>
  );
}
