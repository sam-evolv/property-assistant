'use client';

import { useState, useCallback, useEffect } from 'react';
import { BottomSheet, SheetHeader, SheetItem } from './BottomSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { MILESTONE_ORDER, MILESTONE_LABELS, type UnitPreHandoverData, type SheetType, type Document, type ContactInfo, type FAQ, type MilestoneDates } from './types';
import { Home, Settings, Clock, FileText, HelpCircle, Phone, Calendar, ChevronRight, Check, Mail, MapPin, Key, ClipboardCheck, Zap, Wifi, AlertTriangle, ChevronDown, MessageSquare, Sparkles } from 'lucide-react';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function formatMonth(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

interface PreHandoverPortalProps {
  unit?: UnitPreHandoverData;
  unitId?: string;
  propertyName?: string;
  propertyType?: string;
  houseType?: string;
  purchaserName?: string;
  developmentName?: string;
  developmentLogoUrl?: string | null;
  handoverComplete?: boolean;
  currentMilestone?: string;
  milestoneDates?: MilestoneDates;
  estSnaggingDate?: string | null;
  estHandoverDate?: string | null;
  documents?: Document[];
  contacts?: ContactInfo;
  faqs?: FAQ[];
}

export function PreHandoverPortal(props: PreHandoverPortalProps) {
  const [activeSheet, setActiveSheet] = useState<SheetType>(null);
  const [loadedDocuments, setLoadedDocuments] = useState<Document[]>([]);

  const unit: UnitPreHandoverData = props.unit || {
    unitId: props.unitId || '',
    propertyName: props.propertyName || '',
    propertyType: props.propertyType || '',
    houseType: props.houseType || 'House',
    handoverComplete: props.handoverComplete || false,
    currentMilestone: props.currentMilestone || 'sale_agreed',
    milestoneDates: props.milestoneDates || {},
    estSnaggingDate: props.estSnaggingDate || null,
    estHandoverDate: props.estHandoverDate || null,
    documents: props.documents || loadedDocuments,
    contacts: props.contacts || {},
    faqs: props.faqs || [],
  };

  useEffect(() => {
    if (!props.unit && (!props.documents || props.documents.length === 0) && props.unitId) {
      fetch(`/api/units/${props.unitId}/prehandover`)
        .then(res => res.json())
        .then(data => {
          if (data.documents) {
            setLoadedDocuments(data.documents);
          }
        })
        .catch(err => console.error('Failed to load documents:', err));
    }
  }, [props.unitId, props.unit, props.documents]);

  const effectiveDocuments = props.documents && props.documents.length > 0
    ? props.documents
    : loadedDocuments;

  const openSheet = useCallback((sheet: SheetType) => setActiveSheet(sheet), []);
  const closeSheet = useCallback(() => setActiveSheet(null), []);

  const milestoneIndex = MILESTONE_ORDER.indexOf(unit.currentMilestone as typeof MILESTONE_ORDER[number]);
  const completedCount = milestoneIndex >= 0 ? milestoneIndex + 1 : 0;
  const progressPercent = Math.round((completedCount / MILESTONE_ORDER.length) * 100);
  const currentMilestoneLabel = MILESTONE_LABELS[unit.currentMilestone] || 'Unknown';

  const estDate = unit.currentMilestone === 'snagging'
    ? unit.estSnaggingDate
    : unit.currentMilestone === 'handover'
    ? unit.estHandoverDate
    : null;

  const quickActions = [
    { id: 'timeline', label: 'Timeline', icon: Clock, bgGradient: 'from-[#FEFCE8] to-[#FEF9C3]', iconColor: 'text-[#A67C3A]' },
    { id: 'docs', label: 'Docs', icon: FileText, bgGradient: 'from-[#FEF9C3] to-[#FEF08A]', iconColor: 'text-[#8B6428]' },
    { id: 'faq', label: 'FAQ', icon: HelpCircle, bgGradient: 'from-[#FDE047]/30 to-[#FACC15]/30', iconColor: 'text-[#B8941F]' },
    { id: 'contact', label: 'Contact', icon: Phone, bgGradient: 'from-[#D4AF37]/20 to-[#B8941F]/20', iconColor: 'text-[#D4AF37]' },
  ];

  return (
    <div className="min-h-screen pb-20" style={{ background: 'linear-gradient(180deg, #FAFAF8 0%, #F5F1EA 100%)', fontFamily: "'Inter', -apple-system, sans-serif" }}>
      <header className="px-4 pt-[calc(12px+env(safe-area-inset-top))] pb-2 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-gray-500 font-medium">{getGreeting()}</p>
          <h1 className="text-lg font-bold text-gray-900 tracking-tight">My Home</h1>
        </div>
        <button
          onClick={() => openSheet('settings')}
          className="group w-9 h-9 rounded-lg bg-white/90 backdrop-blur-xl border border-white/90 
            flex items-center justify-center active:scale-95 transition-all duration-200
            shadow-[0_2px_8px_rgba(12,12,12,0.04)] hover:border-[#D4AF37]/20"
        >
          <Settings className="w-4 h-4 text-gray-500 group-hover:text-[#D4AF37] group-hover:rotate-45 transition-all duration-200" />
        </button>
      </header>

      <main className="px-4 space-y-3">
        {props.purchaserName && (
          <p className="text-xs text-gray-600 text-center">
            Welcome to your new home journey,{' '}
            <strong className="text-gray-900 font-semibold">{props.purchaserName}</strong>
          </p>
        )}

        <div className="bg-white/90 backdrop-blur-xl border border-white/90 rounded-2xl p-4 
          shadow-[0_4px_20px_rgba(12,12,12,0.05)] transition-all duration-200">
          <div className="flex justify-center mb-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#FEFCE8] via-[#FEF9C3] to-[#FEF08A] 
                flex items-center justify-center border border-[#D4AF37]/20 shadow-[0_4px_16px_rgba(212,175,55,0.1)]">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
                  flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.2)]">
                  <Home className="w-4.5 h-4.5 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-white border border-[#D4AF37]/30 
                flex items-center justify-center shadow-sm">
                <span className="text-[8px] font-bold text-[#D4AF37]">{completedCount}/{MILESTONE_ORDER.length}</span>
              </div>
            </div>
          </div>

          <div className="text-center">
            <h2 className="text-base font-bold text-gray-900 tracking-tight leading-tight">{unit.propertyName}</h2>
            <p className="text-[11px] text-gray-500 mt-1">
              {unit.propertyType} · {unit.houseType}
            </p>

            <div className="mt-2.5 flex justify-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full 
                bg-gradient-to-r from-emerald-50 to-emerald-100 border border-emerald-200/80 shadow-sm">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-700">
                  On Track · Est. {formatMonth(unit.estHandoverDate)}
                </span>
              </div>
            </div>
          </div>

          <div className="my-4 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/20 to-transparent" />

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Progress</span>
              <span className="text-xs font-bold text-[#D4AF37]">{progressPercent}%</span>
            </div>
            
            <div className="relative">
              <div className="h-2 rounded-full bg-gradient-to-r from-gray-100 to-gray-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] via-[#FACC15] to-[#D4AF37] 
                    transition-all duration-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              
              <div className="absolute inset-0 flex items-center justify-between px-0.5">
                {MILESTONE_ORDER.slice(0, 6).map((milestoneId, idx) => {
                  const isCompleted = idx < milestoneIndex;
                  const isCurrent = idx === milestoneIndex;
                  return (
                    <div
                      key={milestoneId}
                      className={`w-3 h-3 rounded-full flex items-center justify-center transition-all duration-300
                        ${isCompleted 
                          ? 'bg-[#D4AF37] shadow-[0_0_6px_rgba(212,175,55,0.4)]' 
                          : isCurrent
                            ? 'bg-white border-[1.5px] border-[#D4AF37] shadow-sm'
                            : 'bg-gray-200 border border-gray-300'
                        }`}
                    >
                      {isCompleted && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                      {isCurrent && <span className="w-1 h-1 rounded-full bg-[#D4AF37] animate-pulse" />}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 flex items-center justify-center gap-2 py-1.5 px-3 rounded-lg 
              bg-gradient-to-r from-[#FEFCE8]/50 to-[#FEF9C3]/50 border border-[#D4AF37]/10">
              <span className="w-2 h-2 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#FACC15] animate-pulse 
                shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
              <span className="text-xs text-gray-700">
                <strong className="font-semibold text-gray-900">{currentMilestoneLabel}</strong>
                {estDate && <span className="text-gray-400"> · Est. {formatShortDate(estDate)}</span>}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => openSheet(action.id as SheetType)}
                className="group bg-white/90 backdrop-blur-xl border border-white/90 rounded-xl py-3 px-2 text-center 
                  active:scale-[0.96] transition-all duration-200
                  shadow-[0_2px_8px_rgba(12,12,12,0.03)] hover:shadow-[0_4px_12px_rgba(212,175,55,0.1)]
                  hover:border-[#D4AF37]/20"
              >
                <div className={`w-9 h-9 mx-auto rounded-lg bg-gradient-to-br ${action.bgGradient} flex items-center justify-center mb-1.5
                  border border-[#D4AF37]/10 group-hover:border-[#D4AF37]/25 transition-all duration-200`}>
                  <Icon className={`w-4 h-4 ${action.iconColor} transition-transform duration-200 group-hover:scale-110`} />
                </div>
                <span className="text-[10px] font-semibold text-gray-700 group-hover:text-[#8B6428] transition-colors duration-200">
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => openSheet('calendar')}
          className="group w-full bg-white/90 backdrop-blur-xl border border-white/90 rounded-xl p-3 
            active:scale-[0.98] transition-all duration-200
            shadow-[0_2px_8px_rgba(12,12,12,0.03)] hover:shadow-[0_4px_12px_rgba(212,175,55,0.08)]
            hover:border-[#D4AF37]/20"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] 
                flex items-center justify-center border border-[#D4AF37]/15
                group-hover:shadow-[0_0_12px_rgba(212,175,55,0.12)] transition-all duration-200">
                <Calendar className="w-4 h-4 text-[#A67C3A] group-hover:scale-110 transition-transform duration-200" />
              </div>
              <div className="text-left">
                <p className="text-xs font-semibold text-gray-900">Key Dates</p>
                <p className="text-[10px] text-gray-500 leading-tight">Snagging, Handover</p>
              </div>
            </div>
            <span className="text-[10px] font-semibold text-[#D4AF37] flex items-center gap-0.5 
              group-hover:gap-1 transition-all duration-200">
              Add
              <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform duration-200" />
            </span>
          </div>
        </button>

        <button
          onClick={() => openSheet('chat')}
          className="group w-full bg-gradient-to-r from-white/95 to-[#FEFCE8]/60 backdrop-blur-xl 
            border border-[#D4AF37]/20 rounded-xl p-3 
            active:scale-[0.98] transition-all duration-200
            shadow-[0_2px_12px_rgba(212,175,55,0.06)] hover:shadow-[0_4px_16px_rgba(212,175,55,0.12)]
            hover:border-[#D4AF37]/25"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
                flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.2)]
                group-hover:shadow-[0_4px_12px_rgba(212,175,55,0.28)] transition-all duration-200">
                <MessageSquare className="w-4 h-4 text-white group-hover:scale-110 transition-transform duration-200" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-gradient-to-br from-[#FACC15] to-[#D4AF37] 
                flex items-center justify-center shadow-sm">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="flex-1 text-left">
              <p className="text-xs font-semibold text-gray-900">Ask a Question</p>
              <p className="text-[10px] text-gray-500 leading-tight">Get instant answers about your home</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[#D4AF37] group-hover:translate-x-0.5 transition-transform duration-200" />
          </div>
        </button>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 bg-white/98 backdrop-blur-2xl border-t border-[#D4AF37]/15 z-30
          shadow-[0_-4px_16px_rgba(12,12,12,0.04)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="flex items-center justify-around py-1.5 px-2 max-w-md mx-auto">
          {[
            { id: 'home', label: 'Home', icon: Home, active: true },
            { id: 'docs', label: 'Docs', icon: FileText },
            { id: 'chat', label: 'Chat', icon: MessageSquare, badge: true },
            { id: 'faq', label: 'FAQ', icon: HelpCircle },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => item.id !== 'home' && openSheet(item.id as SheetType)}
                className={`relative flex flex-col items-center gap-0.5 py-1.5 px-4 rounded-xl transition-all duration-200
                  ${item.active ? 'bg-gradient-to-b from-[#D4AF37]/10 to-[#D4AF37]/5' : ''}`}
              >
                {item.active && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full 
                    bg-gradient-to-r from-[#D4AF37] to-[#FACC15] shadow-[0_0_8px_rgba(212,175,55,0.4)]" />
                )}
                <div className="relative">
                  <Icon className={`w-5 h-5 transition-all duration-200 ${item.active ? 'text-[#D4AF37] scale-105' : 'text-gray-400'}`} />
                  {item.badge && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#D4AF37]" />
                  )}
                </div>
                <span className={`text-[10px] transition-all duration-200 ${item.active ? 'text-[#D4AF37] font-semibold' : 'text-gray-400 font-medium'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Timeline Sheet */}
      <BottomSheet isOpen={activeSheet === 'timeline'} onClose={closeSheet}>
        <SheetHeader title="Your Timeline" />
        <div className="px-4 py-3 space-y-1 overflow-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {MILESTONE_ORDER.map((milestoneId, idx) => {
            const isComplete = idx < milestoneIndex;
            const isCurrent = idx === milestoneIndex;
            const isPending = idx > milestoneIndex;
            const isHandover = milestoneId === 'handover';
            const label = MILESTONE_LABELS[milestoneId] || milestoneId;
            const date = unit.milestoneDates[milestoneId];
            return (
              <div key={milestoneId} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 ${
                isCurrent ? 'bg-gradient-to-r from-[#FEFCE8]/80 to-[#FEF9C3]/60 border border-[#D4AF37]/20' : 'border border-transparent'
              } ${isPending ? 'opacity-50' : ''}`}>
                {isComplete && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.2)]">
                    <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
                  </div>
                )}
                {isCurrent && (
                  <div className="w-8 h-8 rounded-full bg-white border-2 border-[#D4AF37] flex items-center justify-center shadow-[0_0_8px_rgba(212,175,55,0.25)]">
                    <div className="w-2.5 h-2.5 bg-gradient-to-br from-[#D4AF37] to-[#FACC15] rounded-full animate-pulse" />
                  </div>
                )}
                {isPending && (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                    {isHandover ? <Home className="w-3.5 h-3.5 text-gray-300" /> : <div className="w-2 h-2 bg-gray-300 rounded-full" />}
                  </div>
                )}
                <div className="flex-1">
                  <span className={`text-xs ${isCurrent ? 'font-semibold text-gray-900' : isComplete ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {label}
                  </span>
                  {isCurrent && <span className="ml-1.5 text-[10px] font-semibold text-[#D4AF37]">Current</span>}
                </div>
                <span className={`text-[10px] font-medium ${isCurrent ? 'text-[#D4AF37]' : isComplete ? 'text-gray-500' : 'text-gray-300'}`}>
                  {date ? formatShortDate(date) : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>
      </BottomSheet>

      {/* Documents Sheet */}
      <BottomSheet isOpen={activeSheet === 'docs'} onClose={closeSheet}>
        <SheetHeader title="Your Documents" />
        <div className="px-4 py-3 space-y-2">
          {effectiveDocuments.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/20">
                <FileText className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <p className="text-xs text-gray-500">No documents available yet</p>
            </div>
          ) : (
            effectiveDocuments.map((doc) => (
              <SheetItem key={doc.id} onClick={() => window.open(doc.url, '_blank')}>
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/10">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-gray-900">{doc.name}</p>
                  <p className="text-[10px] text-gray-500">{doc.type} · {doc.size}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
              </SheetItem>
            ))
          )}
        </div>
      </BottomSheet>

      {/* FAQ Sheet */}
      <BottomSheet isOpen={activeSheet === 'faq'} onClose={closeSheet} maxHeight="75vh">
        <SheetHeader title="Frequently Asked" />
        <div className="px-4 py-3 space-y-2 overflow-auto" style={{ maxHeight: 'calc(75vh - 80px)' }}>
          {(unit.faqs || []).length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/20">
                <HelpCircle className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <p className="text-xs text-gray-500">No FAQs available yet</p>
            </div>
          ) : (
            (unit.faqs || []).map((faq, index) => {
              const icons = [Key, ClipboardCheck, Zap, Wifi, AlertTriangle];
              const Icon = icons[index % 5];
              return (
                <details key={faq.id} className="group rounded-xl bg-gray-50/80 overflow-hidden border border-transparent hover:border-[#D4AF37]/15 transition-all duration-200">
                  <summary className="flex items-center gap-2.5 p-3 cursor-pointer list-none">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center shrink-0 border border-[#D4AF37]/10">
                      <Icon className="w-4 h-4 text-[#A67C3A]" />
                    </div>
                    <span className="flex-1 text-xs font-medium text-gray-900">{faq.question}</span>
                    <ChevronDown className="w-4 h-4 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-3 pb-3 ml-[42px]">
                    <p className="text-[11px] text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                </details>
              );
            })
          )}
        </div>
      </BottomSheet>

      {/* Contact Sheet */}
      <BottomSheet isOpen={activeSheet === 'contact'} onClose={closeSheet}>
        <SheetHeader title="Get in Touch" />
        <div className="px-4 py-3 space-y-2">
          {unit.contacts?.salesPhone && (
            <SheetItem onClick={() => window.location.href = `tel:${unit.contacts?.salesPhone}`}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/10">
                <Phone className="w-5 h-5 text-[#A67C3A]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900">Call Sales Team</p>
                <p className="text-[10px] text-gray-500">{unit.contacts.salesPhone}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
            </SheetItem>
          )}
          {unit.contacts?.salesEmail && (
            <SheetItem onClick={() => window.location.href = `mailto:${unit.contacts?.salesEmail}`}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] flex items-center justify-center border border-[#D4AF37]/10">
                <Mail className="w-5 h-5 text-[#8B6428]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900">Email Us</p>
                <p className="text-[10px] text-gray-500">{unit.contacts.salesEmail}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
            </SheetItem>
          )}
          {unit.contacts?.showHouseAddress && (
            <SheetItem onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(unit.contacts?.showHouseAddress || '')}`, '_blank')}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30 flex items-center justify-center border border-[#D4AF37]/10">
                <MapPin className="w-5 h-5 text-[#B8941F]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900">Show House</p>
                <p className="text-[10px] text-gray-500">{unit.contacts.showHouseAddress}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
            </SheetItem>
          )}
          {!unit.contacts?.salesPhone && !unit.contacts?.salesEmail && !unit.contacts?.showHouseAddress && (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/20">
                <Phone className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <p className="text-xs text-gray-500">Contact information coming soon</p>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Calendar Sheet */}
      <BottomSheet isOpen={activeSheet === 'calendar'} onClose={closeSheet}>
        <SheetHeader title="Add to Calendar" subtitle="Add key dates to your calendar" />
        <div className="px-4 py-3 space-y-2">
          <SheetItem onClick={() => { closeSheet(); }}>
            <div className="w-10 h-10 rounded-lg bg-white border border-[#D4AF37]/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">Google Calendar</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
          </SheetItem>
          <SheetItem onClick={() => { closeSheet(); }}>
            <div className="w-10 h-10 rounded-lg bg-white border border-[#D4AF37]/15 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-800" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">Apple Calendar</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
          </SheetItem>
        </div>
      </BottomSheet>

      {/* Chat Sheet */}
      <BottomSheet isOpen={activeSheet === 'chat'} onClose={closeSheet}>
        <SheetHeader title="Ask a Question" subtitle="Get help with your home journey" />
        <div className="px-4 py-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center shadow-[0_4px_16px_rgba(212,175,55,0.25)]">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Coming Soon</h3>
          <p className="text-xs text-gray-500">Our AI assistant will be available to answer your questions about your new home.</p>
        </div>
      </BottomSheet>

      {/* Settings Sheet */}
      <BottomSheet isOpen={activeSheet === 'settings'} onClose={closeSheet}>
        <SettingsSheet />
      </BottomSheet>
    </div>
  );
}
