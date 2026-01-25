'use client';

import { useState, useEffect } from 'react';
import { PreHandoverHome } from '@/components/pre-handover/PreHandoverHome';
import { BottomSheet, SheetHeader, SheetItem } from '@/components/pre-handover/BottomSheet';
import { BottomNav } from '@/components/pre-handover/BottomNav';
import { SettingsSheet } from '@/components/pre-handover/sheets/SettingsSheet';
import type { PreHandoverData } from '@/lib/pre-handover/types';
import { Check, Home, FileText, Phone, Mail, MapPin, Calendar, Clock, HelpCircle, Settings, ChevronRight, Send, Bot, User, Key, ClipboardCheck, Zap, Wifi, AlertTriangle, ChevronDown } from 'lucide-react';

export default function PreHandoverPage() {
  const [data, setData] = useState<PreHandoverData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([
    { id: '1', role: 'assistant', content: "Hello! I'm your property assistant. How can I help you today?" }
  ]);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/purchaser/pre-handover');
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to load pre-handover data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchData();
  }, []);

  const openSheet = (name: string) => setActiveSheet(name);
  const closeSheet = () => setActiveSheet(null);

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    setChatMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: chatInput }]);
    setChatInput('');
    setTimeout(() => {
      setChatMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: "Thank you for your question. Our team will get back to you shortly." 
      }]);
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-[#FAFAF8] to-[#F5F1EA]">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <PreHandoverHome data={data} onOpenSheet={openSheet} />
      <BottomNav onOpenSheet={openSheet} />

      {/* Timeline Sheet */}
      <BottomSheet isOpen={activeSheet === 'timeline'} onClose={closeSheet}>
        <SheetHeader title="Your Timeline" />
        <div className="px-4 py-3 space-y-1 overflow-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {data.milestones.map((milestone) => {
            const isComplete = milestone.completed;
            const isCurrent = milestone.current;
            const isPending = !isComplete && !isCurrent;
            const isHandover = milestone.id === 'handover';
            return (
              <div key={milestone.id} className={`flex items-center gap-3 p-2.5 rounded-lg transition-all duration-200 ${
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
                    {milestone.label}
                  </span>
                  {isCurrent && <span className="ml-1.5 text-[10px] font-semibold text-[#D4AF37]">Current</span>}
                </div>
                <span className={`text-[10px] font-medium ${isCurrent ? 'text-[#D4AF37]' : isComplete ? 'text-gray-500' : 'text-gray-300'}`}>
                  {milestone.date || milestone.estimatedDate || 'Pending'}
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
          {data.documents.length === 0 ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/20">
                <FileText className="w-5 h-5 text-[#D4AF37]" />
              </div>
              <p className="text-xs text-gray-500">No documents available yet</p>
            </div>
          ) : (
            data.documents.map((doc) => (
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
          {data.faqs.map((faq, index) => {
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
          })}
        </div>
      </BottomSheet>

      {/* Contact Sheet */}
      <BottomSheet isOpen={activeSheet === 'contact'} onClose={closeSheet}>
        <SheetHeader title="Get in Touch" />
        <div className="px-4 py-3 space-y-2">
          <SheetItem onClick={() => window.location.href = `tel:${data.contact.phone}`}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/10">
              <Phone className="w-5 h-5 text-[#A67C3A]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">Call Sales Team</p>
              <p className="text-[10px] text-gray-500">{data.contact.phone}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
          </SheetItem>
          <SheetItem onClick={() => window.location.href = `mailto:${data.contact.email}`}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEF9C3] to-[#FEF08A] flex items-center justify-center border border-[#D4AF37]/10">
              <Mail className="w-5 h-5 text-[#8B6428]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">Email Us</p>
              <p className="text-[10px] text-gray-500">{data.contact.email}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
          </SheetItem>
          <SheetItem onClick={() => window.open(`https://maps.google.com?q=${encodeURIComponent(data.contact.address)}`, '_blank')}>
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FDE047]/30 to-[#FACC15]/30 flex items-center justify-center border border-[#D4AF37]/10">
              <MapPin className="w-5 h-5 text-[#B8941F]" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-gray-900">Show House</p>
              <p className="text-[10px] text-gray-500">{data.contact.address}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
          </SheetItem>
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

      {/* Settings Sheet */}
      <BottomSheet isOpen={activeSheet === 'settings'} onClose={closeSheet}>
        <SettingsSheet />
      </BottomSheet>

      {/* Chat Sheet */}
      <BottomSheet isOpen={activeSheet === 'chat'} onClose={closeSheet}>
        <SheetHeader title="Ask a Question" subtitle="Get help with your home journey" />
        <div className="flex flex-col" style={{ height: 'calc(70vh - 80px)' }}>
          <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
            {chatMessages.map((message) => (
              <div key={message.id} className={`flex gap-2 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                  message.role === 'assistant' ? 'bg-gradient-to-br from-[#D4AF37] to-[#B8941F] shadow-[0_2px_8px_rgba(212,175,55,0.2)]' : 'bg-gray-100'
                }`}>
                  {message.role === 'assistant' ? <Bot className="w-4 h-4 text-white" /> : <User className="w-4 h-4 text-gray-500" />}
                </div>
                <div className={`max-w-[75%] p-2.5 rounded-xl ${
                  message.role === 'assistant' ? 'bg-gray-50/80 border border-gray-100 rounded-tl-sm' : 'bg-gradient-to-r from-[#D4AF37] to-[#B8941F] text-white rounded-tr-sm shadow-[0_2px_8px_rgba(212,175,55,0.15)]'
                }`}>
                  <p className={`text-xs leading-relaxed ${message.role === 'user' ? 'text-white' : 'text-gray-700'}`}>{message.content}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t border-[#D4AF37]/10 bg-white/80 backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                placeholder="Type your question..."
                className="flex-1 px-3 py-2.5 bg-gray-50/80 border border-gray-200 rounded-lg text-xs placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37]/30 transition-all duration-200"
              />
              <button onClick={handleSendChat} className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#D4AF37] to-[#B8941F] flex items-center justify-center shadow-[0_2px_8px_rgba(212,175,55,0.2)] hover:shadow-[0_4px_12px_rgba(212,175,55,0.28)] active:scale-95 transition-all duration-200">
                <Send className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>
        </div>
      </BottomSheet>

      {/* More Sheet */}
      <BottomSheet isOpen={activeSheet === 'more'} onClose={closeSheet}>
        <SheetHeader title="More Options" subtitle="Explore all features" />
        <div className="px-4 py-3 space-y-2 overflow-auto" style={{ maxHeight: 'calc(70vh - 80px)' }}>
          {[
            { id: 'timeline', label: 'Your Timeline', desc: 'Track your progress', Icon: Clock },
            { id: 'docs', label: 'Documents', desc: 'Floor plans, contracts & more', Icon: FileText },
            { id: 'faq', label: 'FAQ', desc: 'Common questions answered', Icon: HelpCircle },
            { id: 'contact', label: 'Contact Us', desc: 'Get in touch with our team', Icon: Phone },
            { id: 'calendar', label: 'Calendar', desc: 'Add key dates to your calendar', Icon: Calendar },
            { id: 'settings', label: 'Settings', desc: 'Notifications & preferences', Icon: Settings },
          ].map((item) => (
            <SheetItem key={item.id} onClick={() => { closeSheet(); setTimeout(() => openSheet(item.id), 100); }}>
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#FEFCE8] to-[#FEF9C3] flex items-center justify-center border border-[#D4AF37]/10">
                <item.Icon className="w-5 h-5 text-[#A67C3A]" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                <p className="text-[10px] text-gray-500">{item.desc}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-[#D4AF37] transition-all duration-200" />
            </SheetItem>
          ))}
        </div>
      </BottomSheet>
    </>
  );
}
