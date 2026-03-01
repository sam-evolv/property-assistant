'use client';

import Link from 'next/link';
import Image from 'next/image';
import {
  Sparkles, FolderArchive, MessageSquare, TrendingUp,
  Sun, Users, AlertTriangle, CheckCircle, ChevronRight,
  Zap, Battery, Shield,
} from 'lucide-react';

const tokens = {
  gold: '#D4AF37',
  goldDark: '#B8934C',
};

// Mock stats
const stats = [
  { label: 'Active Installations', value: '247', icon: Sun, color: 'text-amber-500', change: '+12 this month' },
  { label: 'Total Capacity', value: '1.8 MWp', icon: Zap, color: 'text-blue-500', change: '' },
  { label: 'Avg System Health', value: '94%', icon: Battery, color: 'text-emerald-500', change: '+2%' },
  { label: 'Open Tickets', value: '8', icon: AlertTriangle, color: 'text-amber-500', change: '3 urgent' },
];

const quickLinks = [
  { href: '/care-dashboard/intelligence', label: 'Intelligence', description: 'Ask anything about your installations', icon: Sparkles },
  { href: '/care-dashboard/archive', label: 'Document Archive', description: 'Installation records and documentation', icon: FolderArchive },
  { href: '/care-dashboard/communications', label: 'Communications', description: 'Customer and installer messaging', icon: MessageSquare },
];

const recentActivity = [
  { type: 'success', text: 'Installation #247 — system commissioned successfully', time: '2 hours ago' },
  { type: 'warning', text: 'Installation #231 — inverter communication lost', time: '4 hours ago' },
  { type: 'info', text: 'Warranty claim #WC-089 resolved for Installation #198', time: '1 day ago' },
  { type: 'success', text: 'SEAI grant application approved for Installation #245', time: '1 day ago' },
  { type: 'info', text: 'Annual service completed for 12 installations in Dublin South', time: '2 days ago' },
];

export default function CareDashboardOverview() {
  return (
    <div className="min-h-full bg-gray-50">
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Care Dashboard</h1>
              <p className="text-sm text-gray-500 mt-1">Solar aftercare management overview</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="bg-white border border-gold-100 rounded-xl shadow-sm p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 da-anim-in">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{stat.label}</span>
                    <div className="w-9 h-9 rounded-lg bg-gold-50 flex items-center justify-center">
                      <Icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  {stat.change && <p className="text-xs text-gray-500 mt-1">{stat.change}</p>}
                </div>
              );
            })}
          </div>

          {/* Quick Links + Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Links */}
            <div className="lg:col-span-1 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-4 p-4 bg-white border border-gold-100 rounded-lg shadow-sm
                      hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${tokens.gold} 0%, ${tokens.goldDark} 100%)` }}
                    >
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 group-hover:text-[#D4AF37] transition-colors">{link.label}</p>
                      <p className="text-xs text-gray-500">{link.description}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-colors" />
                  </Link>
                );
              })}
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-2">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Recent Activity</h3>
              <div className="bg-white border border-gold-100 rounded-lg shadow-sm overflow-hidden">
                {recentActivity.map((activity, i) => {
                  const iconConfig = {
                    success: { icon: CheckCircle, color: 'text-emerald-500' },
                    warning: { icon: AlertTriangle, color: 'text-amber-500' },
                    info: { icon: Sparkles, color: 'text-blue-500' },
                  };
                  const config = iconConfig[activity.type as keyof typeof iconConfig];
                  const Icon = config.icon;
                  return (
                    <div
                      key={i}
                      className={`flex items-start gap-3 px-4 py-3 ${
                        i < recentActivity.length - 1 ? 'border-b border-gray-50' : ''
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${config.color} flex-shrink-0 mt-0.5`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700">{activity.text}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{activity.time}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
