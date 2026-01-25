'use client';

import { useState, useCallback, useEffect } from 'react';
import { BottomSheet, SheetHeader, SheetItem } from './BottomSheet';
import { SettingsSheet } from './sheets/SettingsSheet';
import { MILESTONE_ORDER, MILESTONE_LABELS, type UnitPreHandoverData, type SheetType, type Document, type ContactInfo, type FAQ, type MilestoneDates } from './types';
import { Home, Settings, Clock, FileText, HelpCircle, Phone, Calendar, ChevronRight, Check, Mail, MapPin, Key, ClipboardCheck, Zap, Wifi, AlertTriangle, ChevronDown, MessageSquare, Sparkles, Bell } from 'lucide-react';

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
    { id: 'timeline', label: 'Timeline', icon: Clock },
    { id: 'docs', label: 'Docs', icon: FileText },
    { id: 'faq', label: 'FAQ', icon: HelpCircle },
    { id: 'contact', label: 'Contact', icon: Phone },
  ];

  return (
    <div className="min-h-screen bg-white pb-20" style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}>
      {/* Header with Logo */}
      <header 
        className="sticky top-0 z-20 bg-white/95 backdrop-blur-xl border-b border-gray-100"
        style={{ paddingTop: 'calc(12px + env(safe-area-inset-top))' }}
      >
        <div className="px-5 pb-3 flex items-center justify-between">
          {/* Development Logo */}
          <div className="flex items-center gap-2">
            {props.developmentLogoUrl ? (
              <img 
                src={props.developmentLogoUrl} 
                alt={props.developmentName || 'Development'} 
                className="h-8 w-auto object-contain"
              />
            ) : props.developmentName ? (
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center">
                  <Home className="w-3.5 h-3.5 text-white" />
                </div>
                <span className="text-sm font-semibold text-gray-900">{props.developmentName}</span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-gray-900">My Home</span>
            )}
          </div>
          
          {/* Right Side Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => openSheet('settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center text-gray-500 
                hover:bg-gray-100 active:scale-95 transition-all duration-150"
            >
              <Settings className="w-5 h-5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      <main className="px-5 py-6 space-y-5">
        {/* Welcome Message */}
        {props.purchaserName && (
          <p className="text-sm text-gray-600 text-center">
            {getGreeting()}, <span className="font-medium text-gray-900">{props.purchaserName}</span>
          </p>
        )}

        {/* Property Card - Cleaner Design */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          {/* Home Icon */}
          <div className="flex justify-center mb-4">
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-50 to-amber-100 
                flex items-center justify-center border border-[#D4AF37]/20">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
                  flex items-center justify-center shadow-sm">
                  <Home className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border border-gray-200 
                flex items-center justify-center shadow-sm">
                <span className="text-[9px] font-bold text-[#D4AF37]">{completedCount}/{MILESTONE_ORDER.length}</span>
              </div>
            </div>
          </div>

          {/* Property Info */}
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">{unit.propertyName}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {unit.propertyType} · {unit.houseType}
            </p>

            {/* Status Badge */}
            <div className="mt-4 flex justify-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full 
                bg-emerald-50 border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-xs font-medium text-emerald-700">
                  On Track · Est. {formatMonth(unit.estHandoverDate)}
                </span>
              </div>
            </div>
          </div>

          {/* Divider */}
          <div className="my-5 h-px bg-gray-100" />

          {/* Progress Section */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Progress</span>
              <span className="text-sm font-semibold text-[#D4AF37]">{progressPercent}%</span>
            </div>
            
            <div className="relative">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-[#E8C878] transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              
              {/* Milestone Dots */}
              <div className="absolute inset-0 flex items-center justify-between">
                {MILESTONE_ORDER.slice(0, 6).map((milestoneId, idx) => {
                  const isCompleted = idx < milestoneIndex;
                  const isCurrent = idx === milestoneIndex;
                  return (
                    <div
                      key={milestoneId}
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all duration-300
                        ${isCompleted 
                          ? 'bg-[#D4AF37]' 
                          : isCurrent
                            ? 'bg-white border-2 border-[#D4AF37]'
                            : 'bg-gray-200'
                        }`}
                    >
                      {isCompleted && <Check className="w-2 h-2 text-white" strokeWidth={3} />}
                      {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37]" />}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Current Milestone */}
            <div className="mt-4 flex items-center justify-center gap-2 py-2 px-4 rounded-lg bg-amber-50/50 border border-[#D4AF37]/10">
              <span className="w-2 h-2 rounded-full bg-[#D4AF37] animate-pulse" />
              <span className="text-sm text-gray-700">
                <span className="font-medium text-gray-900">{currentMilestoneLabel}</span>
                {estDate && <span className="text-gray-500"> · Est. {formatShortDate(estDate)}</span>}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions - Pill Chip Style (like assistant prompt chips) */}
        <div className="flex flex-wrap justify-center gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                onClick={() => openSheet(action.id as SheetType)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full 
                  bg-white border border-[#D4AF37]/40 
                  hover:border-[#D4AF37] hover:bg-amber-50/30
                  active:scale-[0.97] transition-all duration-150"
              >
                <Icon className="w-4 h-4 text-[#B8941F]" strokeWidth={1.5} />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
              </button>
            );
          })}
        </div>

        {/* Key Dates Card */}
        <button
          onClick={() => openSheet('calendar')}
          className="w-full bg-white rounded-xl border border-gray-200 p-4 
            hover:border-[#D4AF37]/40 active:scale-[0.99] transition-all duration-150 text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center border border-[#D4AF37]/20">
                <Calendar className="w-5 h-5 text-[#B8941F]" strokeWidth={1.5} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Key Dates</p>
                <p className="text-xs text-gray-500">Snagging, Handover</p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-[#D4AF37]">
              <span className="text-xs font-medium">Add to Calendar</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        </button>

        {/* Ask Question Card */}
        <button
          onClick={() => openSheet('chat')}
          className="w-full bg-white rounded-xl border border-[#D4AF37]/30 p-4 
            hover:border-[#D4AF37]/60 hover:bg-amber-50/20
            active:scale-[0.99] transition-all duration-150 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] 
                flex items-center justify-center shadow-sm">
                <MessageSquare className="w-5 h-5 text-white" strokeWidth={1.5} />
              </div>
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 
                flex items-center justify-center">
                <Sparkles className="w-2.5 h-2.5 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Ask a Question</p>
              <p className="text-xs text-gray-500">Get answers about your home</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#D4AF37]" />
          </div>
        </button>
      </main>

      {/* Bottom Nav - Clean Style matching Assistant */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-30"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 16px)' }}
      >
        <div className="flex items-center justify-around py-2 px-4 max-w-md mx-auto">
          {[
            { id: 'home', label: 'Home', icon: Home, active: true },
            { id: 'docs', label: 'Docs', icon: FileText },
            { id: 'chat', label: 'Chat', icon: MessageSquare },
            { id: 'more', label: 'More', icon: Settings },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => item.id !== 'home' && openSheet(item.id as SheetType)}
                className="flex flex-col items-center gap-1 py-1 px-3 transition-all duration-150"
              >
                <Icon 
                  className={`w-5 h-5 ${item.active ? 'text-[#D4AF37]' : 'text-gray-400'}`} 
                  strokeWidth={1.5} 
                />
                <span className={`text-[10px] ${item.active ? 'text-[#D4AF37] font-medium' : 'text-gray-500'}`}>
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
        <div className="px-5 py-4 space-y-1 overflow-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {MILESTONE_ORDER.map((milestoneId, idx) => {
            const isComplete = idx < milestoneIndex;
            const isCurrent = idx === milestoneIndex;
            const isPending = idx > milestoneIndex;
            const isHandover = milestoneId === 'handover';
            const label = MILESTONE_LABELS[milestoneId] || milestoneId;
            const date = unit.milestoneDates[milestoneId];
            return (
              <div key={milestoneId} className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${
                isCurrent ? 'bg-amber-50 border border-[#D4AF37]/20' : 'border border-transparent'
              } ${isPending ? 'opacity-50' : ''}`}>
                {isComplete && (
                  <div className="w-9 h-9 rounded-full bg-[#D4AF37] flex items-center justify-center">
                    <Check className="w-4 h-4 text-white" strokeWidth={2.5} />
                  </div>
                )}
                {isCurrent && (
                  <div className="w-9 h-9 rounded-full bg-white border-2 border-[#D4AF37] flex items-center justify-center">
                    <div className="w-3 h-3 bg-[#D4AF37] rounded-full animate-pulse" />
                  </div>
                )}
                {isPending && (
                  <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200">
                    {isHandover ? <Home className="w-4 h-4 text-gray-400" /> : <div className="w-2 h-2 bg-gray-300 rounded-full" />}
                  </div>
                )}
                <div className="flex-1">
                  <span className={`text-sm ${isCurrent ? 'font-semibold text-gray-900' : isComplete ? 'font-medium text-gray-900' : 'text-gray-500'}`}>
                    {label}
                  </span>
                  {isCurrent && <span className="ml-2 text-xs font-medium text-[#D4AF37]">Current</span>}
                </div>
                <span className={`text-xs ${isCurrent ? 'text-[#D4AF37] font-medium' : isComplete ? 'text-gray-500' : 'text-gray-400'}`}>
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
        <div className="px-5 py-4 space-y-2">
          {effectiveDocuments.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center border border-[#D4AF37]/20">
                <FileText className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <p className="text-sm text-gray-500">No documents available yet</p>
            </div>
          ) : (
            effectiveDocuments.map((doc) => (
              <SheetItem key={doc.id} onClick={() => window.open(doc.url, '_blank')}>
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
                  <FileText className="w-5 h-5 text-[#D4AF37]" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{doc.name}</p>
                  <p className="text-xs text-gray-500">{doc.type} · {doc.size}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400" />
              </SheetItem>
            ))
          )}
        </div>
      </BottomSheet>

      {/* FAQ Sheet */}
      <BottomSheet isOpen={activeSheet === 'faq'} onClose={closeSheet} maxHeight="75vh">
        <SheetHeader title="Frequently Asked" />
        <div className="px-5 py-4 space-y-2 overflow-auto" style={{ maxHeight: 'calc(75vh - 80px)' }}>
          {(unit.faqs || []).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center border border-[#D4AF37]/20">
                <HelpCircle className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <p className="text-sm text-gray-500">No FAQs available yet</p>
            </div>
          ) : (
            (unit.faqs || []).map((faq, index) => {
              const icons = [Key, ClipboardCheck, Zap, Wifi, AlertTriangle];
              const Icon = icons[index % 5];
              return (
                <details key={faq.id} className="group rounded-xl bg-gray-50 overflow-hidden border border-gray-100 hover:border-[#D4AF37]/20 transition-all duration-200">
                  <summary className="flex items-center gap-3 p-4 cursor-pointer list-none">
                    <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center shrink-0 border border-[#D4AF37]/10">
                      <Icon className="w-4 h-4 text-[#B8941F]" />
                    </div>
                    <span className="flex-1 text-sm font-medium text-gray-900">{faq.question}</span>
                    <ChevronDown className="w-5 h-5 text-gray-400 transition-transform duration-200 group-open:rotate-180" />
                  </summary>
                  <div className="px-4 pb-4 ml-12">
                    <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
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
        <div className="px-5 py-4 space-y-2">
          {unit.contacts?.salesPhone && (
            <SheetItem onClick={() => window.location.href = `tel:${unit.contacts?.salesPhone}`}>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
                <Phone className="w-5 h-5 text-[#B8941F]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Call Sales Team</p>
                <p className="text-xs text-gray-500">{unit.contacts.salesPhone}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </SheetItem>
          )}
          {unit.contacts?.salesEmail && (
            <SheetItem onClick={() => window.location.href = `mailto:${unit.contacts?.salesEmail}`}>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
                <Mail className="w-5 h-5 text-[#B8941F]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Email Us</p>
                <p className="text-xs text-gray-500">{unit.contacts.salesEmail}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </SheetItem>
          )}
          {unit.contacts?.showHouseAddress && (
            <SheetItem onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(unit.contacts?.showHouseAddress || '')}`, '_blank')}>
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
                <MapPin className="w-5 h-5 text-[#B8941F]" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">Show House</p>
                <p className="text-xs text-gray-500">{unit.contacts.showHouseAddress}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </SheetItem>
          )}
          {!unit.contacts?.salesPhone && !unit.contacts?.salesEmail && !unit.contacts?.showHouseAddress && (
            <div className="text-center py-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center border border-[#D4AF37]/20">
                <Phone className="w-6 h-6 text-[#D4AF37]" />
              </div>
              <p className="text-sm text-gray-500">Contact information coming soon</p>
            </div>
          )}
        </div>
      </BottomSheet>

      {/* Calendar Sheet */}
      <BottomSheet isOpen={activeSheet === 'calendar'} onClose={closeSheet}>
        <SheetHeader title="Add to Calendar" subtitle="Add key dates to your calendar" />
        <div className="px-5 py-4 space-y-2">
          <SheetItem onClick={() => { closeSheet(); }}>
            <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-[#D4AF37]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Google Calendar</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </SheetItem>
          <SheetItem onClick={() => { closeSheet(); }}>
            <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-gray-700" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Apple Calendar</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </SheetItem>
        </div>
      </BottomSheet>

      {/* Chat Sheet */}
      <BottomSheet isOpen={activeSheet === 'chat'} onClose={closeSheet}>
        <SheetHeader title="Ask a Question" subtitle="Get help with your home journey" />
        <div className="px-5 py-8 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center">
            <MessageSquare className="w-7 h-7 text-white" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-2">Coming Soon</h3>
          <p className="text-sm text-gray-500 max-w-xs mx-auto">Our AI assistant will be available to answer your questions about your new home.</p>
        </div>
      </BottomSheet>

      {/* More Sheet */}
      <BottomSheet isOpen={activeSheet === 'more'} onClose={closeSheet}>
        <SheetHeader title="More Options" />
        <div className="px-5 py-4 space-y-2">
          <SheetItem onClick={() => { closeSheet(); setTimeout(() => openSheet('timeline'), 100); }}>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
              <Clock className="w-5 h-5 text-[#B8941F]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Timeline</p>
              <p className="text-xs text-gray-500">View your home journey</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </SheetItem>
          <SheetItem onClick={() => { closeSheet(); setTimeout(() => openSheet('faq'), 100); }}>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
              <HelpCircle className="w-5 h-5 text-[#B8941F]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">FAQ</p>
              <p className="text-xs text-gray-500">Frequently asked questions</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </SheetItem>
          <SheetItem onClick={() => { closeSheet(); setTimeout(() => openSheet('contact'), 100); }}>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
              <Phone className="w-5 h-5 text-[#B8941F]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Contact</p>
              <p className="text-xs text-gray-500">Get in touch with us</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </SheetItem>
          <SheetItem onClick={() => { closeSheet(); setTimeout(() => openSheet('settings'), 100); }}>
            <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center border border-[#D4AF37]/10">
              <Settings className="w-5 h-5 text-[#B8941F]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Settings</p>
              <p className="text-xs text-gray-500">Preferences and account</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </SheetItem>
        </div>
      </BottomSheet>

      {/* Settings Sheet */}
      <BottomSheet isOpen={activeSheet === 'settings'} onClose={closeSheet}>
        <SettingsSheet />
      </BottomSheet>
    </div>
  );
}
