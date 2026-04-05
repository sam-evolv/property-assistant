'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useAgent } from '@/lib/agent/AgentContext';
import { type Alert, type DevelopmentSummary } from '@/lib/agent/agentPipelineService';
import {
  AlertTriangle, Clock, Bell, ChevronRight, Zap, Building2,
  BarChart3, FileText, TrendingUp
} from 'lucide-react';
import AgentBottomNav from '../_components/AgentBottomNavNew';

export default function AgentHomePage() {
  const { agent, pipeline, alerts, developments, loading } = useAgent();

  const stats = useMemo(() => {
    if (!pipeline.length) return { total: 0, forSale: 0, saleAgreed: 0, contracted: 0, signed: 0, sold: 0 };
    return {
      total: pipeline.length,
      forSale: pipeline.filter(p => p.status === 'for_sale').length,
      saleAgreed: pipeline.filter(p => p.status === 'sale_agreed').length,
      contracted: pipeline.filter(p => p.status === 'contracts_issued').length,
      signed: pipeline.filter(p => p.status === 'signed').length,
      sold: pipeline.filter(p => p.status === 'sold').length,
    };
  }, [pipeline]);

  if (loading) {
    return (
      <div className="flex flex-col h-dvh bg-[#FAFAF8]" style={{ fontFamily: 'Inter, sans-serif' }}>
        <div className="h-[54px] flex items-center px-5 border-b border-gray-100" />
        <div className="flex-1 p-5 space-y-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="flex flex-col h-dvh bg-[#FAFAF8]" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header */}
      <header className="h-[54px] flex items-center justify-between px-5 flex-shrink-0 bg-[#FAFAF8] border-b border-gray-100/50">
        <div className="flex items-center gap-2">
          <span className="text-[#D4AF37] font-bold text-sm tracking-wide">OPENHOUSE</span>
          <span className="text-gray-300 text-sm">|</span>
          <span className="text-gray-400 text-sm font-medium">{agent?.agencyName || 'Agent'}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500 font-medium">{agent?.displayName}</span>
          <div className="relative">
            <Bell size={20} className="text-gray-400" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {alerts.length}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden" style={{ WebkitOverflowScrolling: 'touch', paddingBottom: 'calc(76px + env(safe-area-inset-bottom, 0px) + 16px)' }}>
        <div className="px-5 pt-5">
          {/* Greeting */}
          <p className="text-gray-400 text-sm mb-1">{greeting}</p>
          <h1 className="text-[28px] font-bold text-gray-900 tracking-tight mb-1">
            {agent?.displayName?.split(' ')[0] || 'Agent'}
          </h1>
          <p className="text-gray-400 text-xs mb-6">
            {agent?.agencyName} &middot; {developments.length} scheme{developments.length !== 1 ? 's' : ''} active
          </p>

          {/* Stats 2x2 grid */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <StatCard icon={<Building2 size={18} />} label="Total Units" value={stats.total} color="#6B7280" bgColor="#F3F4F6" />
            <StatCard icon={<Zap size={18} />} label="For Sale" value={stats.forSale} color="#3B82F6" bgColor="#EFF6FF" />
            <StatCard icon={<FileText size={18} />} label="Contracted" value={stats.contracted} color="#D97706" bgColor="#FFFBEB" />
            <StatCard icon={<TrendingUp size={18} />} label="Sold" value={stats.sold} color="#059669" bgColor="#ECFDF5" />
          </div>

          {/* Urgent Alerts */}
          {alerts.length > 0 && (
            <section className="mb-6">
              <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-gray-400 mb-3">Urgent Alerts</h2>
              <div className="space-y-2">
                {alerts.map((alert, i) => (
                  <AlertCard key={`${alert.unitId}-${alert.type}-${i}`} alert={alert} />
                ))}
              </div>
            </section>
          )}

          {/* Schemes overview */}
          <section className="mb-6">
            <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-gray-400 mb-3">Your Schemes</h2>
            <div className="space-y-2">
              {developments.map(dev => (
                <Link
                  key={dev.id}
                  href={`/agent/pipeline?dev=${dev.id}`}
                  className="block transition-all duration-150 active:scale-[0.98]"
                >
                  <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-gray-900 text-sm">{dev.name}</span>
                      <span className="text-[#D4AF37] text-sm font-bold">{dev.percentSold}%</span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${dev.percentSold}%`,
                          background: 'linear-gradient(90deg, #B8960C, #E8C84A)',
                        }}
                      />
                    </div>
                    <div className="flex gap-3 text-[10px] text-gray-400">
                      <span>{dev.totalUnits} total</span>
                      <span>{dev.forSale} available</span>
                      <span>{dev.saleAgreed} agreed</span>
                      <span>{dev.signed} signed</span>
                      <span>{dev.sold} sold</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* Recent Activity */}
          <section className="mb-6">
            <h2 className="text-[11px] font-semibold tracking-[0.06em] uppercase text-gray-400 mb-3">Recent Activity</h2>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-sm text-gray-400 text-center py-2">No recent activity</p>
            </div>
          </section>
        </div>
      </main>

      {/* Bottom Nav */}
      <AgentBottomNav />
    </div>
  );
}

function StatCard({ icon, label, value, color, bgColor }: { icon: React.ReactNode; label: string; value: number; color: string; bgColor: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 transition-all duration-150 active:scale-[0.98]">
      <div className="flex items-center gap-2.5 mb-2">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: bgColor, color }}>
          {icon}
        </div>
      </div>
      <div className="text-2xl font-bold text-gray-900 tracking-tight">{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

function AlertCard({ alert }: { alert: Alert }) {
  const isOverdue = alert.type === 'overdue_contracts';
  return (
    <Link
      href={`/agent/pipeline/${alert.unitId}`}
      className="block transition-all duration-150 active:scale-[0.98]"
    >
      <div className={`rounded-xl p-3.5 flex items-start gap-3 ${
        isOverdue
          ? 'bg-red-50 border border-red-100'
          : 'bg-amber-50 border border-amber-200'
      }`}>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 ${
          isOverdue ? 'bg-red-100' : 'bg-amber-100'
        }`}>
          {isOverdue
            ? <AlertTriangle size={16} className="text-red-500" />
            : <Clock size={16} className="text-amber-600" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium ${isOverdue ? 'text-red-700' : 'text-amber-800'}`}>
            Unit {alert.unitNumber}: {alert.message}
          </div>
          <div className={`text-xs mt-0.5 ${isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
            {alert.purchaserName} &middot; {alert.developmentName}
          </div>
        </div>
        <ChevronRight size={16} className={isOverdue ? 'text-red-300' : 'text-amber-300'} />
      </div>
    </Link>
  );
}
