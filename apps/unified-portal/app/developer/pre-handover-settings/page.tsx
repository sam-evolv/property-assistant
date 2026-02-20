'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import {
  Calendar,
  CalendarDays,
  ListChecks,
  HelpCircle,
  Phone,
  MessageSquare,
  Palette,
  ChevronDown,
  Bell,
  QrCode,
  Download,
  Link,
} from 'lucide-react';

interface Milestone {
  id: string;
  label: string;
  enabled: boolean;
  notificationMessage?: string;
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
}

interface ContactInfo {
  salesPhone: string;
  salesEmail: string;
  showHouseAddress: string;
}

interface CalendarOptions {
  google: boolean;
  apple: boolean;
  outlook: boolean;
}

interface StatusMessages {
  onTrack: string;
  delayed: string;
}

interface PreHandoverConfig {
  greeting: string;
  introText: string;
  estHandover: string;
  snaggingLead: string;
  calendarOptions: CalendarOptions;
  milestones: Milestone[];
  faqs: FAQ[];
  contacts: ContactInfo;
  statusMessages: StatusMessages;
  branding: {
    accentColor: string;
    developerName: string;
  };
}

const DEFAULT_CONFIG: PreHandoverConfig = {
  greeting: 'Welcome to your new home journey',
  introText: "We're excited to be part of your journey to your new home. This portal will keep you updated on your progress from sale agreed through to getting your keys.",
  estHandover: '2026-03',
  snaggingLead: '3',
  calendarOptions: { google: true, apple: true, outlook: true },
  milestones: [
    { id: 'sale_agreed', label: 'Sale Agreed', enabled: true },
    { id: 'contracts_signed', label: 'Contracts Signed', enabled: true },
    { id: 'kitchen_selection', label: 'Kitchen Selection', enabled: true },
    { id: 'snagging', label: 'Snagging', enabled: true },
    { id: 'closing', label: 'Closing', enabled: true },
    { id: 'handover', label: 'Handover', enabled: true },
  ],
  faqs: [
    { id: 'faq_1', question: 'When will I get my keys?', answer: 'Keys are handed over on closing day, after your solicitor confirms funds have transferred.' },
    { id: 'faq_2', question: 'What happens at snagging?', answer: "You'll walk through your home with our site manager to identify any minor defects." },
    { id: 'faq_3', question: 'How do I set up electricity?', answer: 'Contact your chosen supplier before closing with the MPRN from your documents.' },
  ],
  contacts: {
    salesPhone: '+353 21 456 7890',
    salesEmail: 'sales@development.ie',
    showHouseAddress: '',
  },
  statusMessages: {
    onTrack: 'On Track',
    delayed: 'Slight Delay',
  },
  branding: {
    accentColor: '#D4AF37',
    developerName: '',
  },
};

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const GripIcon = () => (
  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
  </svg>
);

export default function PreHandoverSettingsPage() {
  const { developmentId } = useCurrentContext();
  const [config, setConfig] = useState<PreHandoverConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const [activeNav, setActiveNav] = useState('home');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [expandedMilestoneNotif, setExpandedMilestoneNotif] = useState<string | null>(null);

  const [sectionOpen, setSectionOpen] = useState({
    keyDates: true,
    calendar: false,
    milestones: true,
    faqs: false,
    contacts: false,
    statusMessages: false,
    branding: false,
  });

  useEffect(() => {
    if (developmentId) {
      fetchConfig();
    } else {
      setIsLoading(false);
    }
  }, [developmentId]);

  const fetchConfig = async () => {
    if (!developmentId) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/developments/${developmentId}/prehandover-config`);
      if (response.ok) {
        const data = await response.json();
        setConfig({ ...DEFAULT_CONFIG, ...data, branding: { ...DEFAULT_CONFIG.branding, ...(data.branding || {}) } });
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!developmentId) return;
    setIsSaving(true);
    try {
      const response = await fetch(`/api/developments/${developmentId}/prehandover-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        showToast('Changes saved successfully!');
      } else {
        showToast('Failed to save settings');
      }
    } catch (error) {
      showToast('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const showToast = (message: string) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  };

  const updateMilestoneLabel = (id: string, label: string) => {
    setConfig(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === id ? { ...m, label } : m),
    }));
  };

  const toggleMilestone = (id: string) => {
    setConfig(prev => ({
      ...prev,
      milestones: prev.milestones.map(m => m.id === id ? { ...m, enabled: !m.enabled } : m),
    }));
  };

  const addMilestone = () => {
    const newId = `custom_${Date.now()}`;
    const milestones = [...config.milestones];
    milestones.splice(milestones.length - 1, 0, { id: newId, label: 'New Milestone', enabled: true });
    setConfig(prev => ({ ...prev, milestones }));
    showToast('Milestone added');
  };

  const addFaq = () => {
    const newId = `faq_${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      faqs: [...prev.faqs, { id: newId, question: '', answer: '' }],
    }));
    showToast('FAQ added');
  };

  const updateFaq = (id: string, field: 'question' | 'answer', value: string) => {
    setConfig(prev => ({
      ...prev,
      faqs: prev.faqs.map(f => f.id === id ? { ...f, [field]: value } : f),
    }));
  };

  const removeFaq = (id: string) => {
    setConfig(prev => ({
      ...prev,
      faqs: prev.faqs.filter(f => f.id !== id),
    }));
    showToast('FAQ removed');
  };

  const formatEstMonth = (val: string) => {
    if (!val) return 'TBD';
    const [year, month] = val.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[parseInt(month) - 1] + ' ' + year;
  };

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const generateQRCode = async () => {
    try {
      const QRCode = (await import('qrcode')).default;
      const url = `${window.location.origin}/homes/preview?dev=${developmentId}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 200,
        margin: 2,
        color: { dark: '#1a1a1a', light: '#ffffff' },
      });
      setQrCodeDataUrl(dataUrl);
    } catch (e) {
      console.error('QR generation failed', e);
    }
  };

  const enabledMilestones = config.milestones.filter(m => m.enabled);
  const currentMilestoneIndex = enabledMilestones.length > 0 ? Math.min(3, enabledMilestones.length - 1) : 0;
  const progressPercent = enabledMilestones.length > 0 ? Math.round(((currentMilestoneIndex + 1) / enabledMilestones.length) * 100) : 0;

  const openSheet = (name: string) => {
    setActiveSheet(name);
    if (name === 'docs') setActiveNav('docs');
    else if (name === 'faq') setActiveNav('faq');
  };

  const closeSheet = () => {
    setActiveSheet(null);
    setActiveNav('home');
  };

  const accent = config.branding.accentColor || '#D4AF37';

  if (!developmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Please select a development first</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="w-8 h-8 rounded-full border-2 border-[#D4AF37] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Toast */}
      <div className={`fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-lg text-sm font-medium z-50 transition-all duration-300 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {toast.message}
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
      `}</style>

      <main className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-Handover Portal Settings</h1>
              <p className="text-gray-500 mt-1">Customise the experience purchasers see before their property is handed over.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => developmentId && window.open(`/preview?developmentId=${developmentId}`, '_blank')}
                disabled={!developmentId}
                className="bg-white text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Preview Portal
              </button>
              <button
                onClick={saveConfig}
                disabled={isSaving}
                className="bg-[#D4AF37] text-white px-5 py-2.5 rounded-lg font-medium text-sm hover:bg-[#c49843] transition-all disabled:opacity-50"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8">
            {/* LEFT COLUMN: Configuration Forms */}
            <div className="col-span-2 space-y-4">

              {/* ── Key Dates Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, keyDates: !prev.keyDates }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Key Dates</p>
                      <p className="text-xs text-gray-500">Est. handover month and snagging lead time</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.keyDates ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.keyDates && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="space-y-4 pt-3">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Est. Handover Month</label>
                          <select
                            value={config.estHandover}
                            onChange={(e) => setConfig(prev => ({ ...prev, estHandover: e.target.value }))}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10 transition-all bg-white"
                          >
                            <option value="">Select month...</option>
                            {['2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09','2026-10','2026-11','2026-12','2027-01','2027-02','2027-03'].map(m => {
                              const [y, mo] = m.split('-');
                              const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                              return <option key={m} value={m}>{months[parseInt(mo) - 1]} {y}</option>;
                            })}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Snagging Lead Time</label>
                          <select
                            value={config.snaggingLead}
                            onChange={(e) => setConfig(prev => ({ ...prev, snaggingLead: e.target.value }))}
                            className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10 transition-all bg-white"
                          >
                            <option value="2">2 weeks before handover</option>
                            <option value="3">3 weeks before handover</option>
                            <option value="4">4 weeks before handover</option>
                          </select>
                        </div>
                      </div>
                      <p className="text-xs text-gray-400">Shown in status badge. Override per unit in Sales Pipeline.</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Calendar Integration Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, calendar: !prev.calendar }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <CalendarDays className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Calendar Integration</p>
                      <p className="text-xs text-gray-500">Allow purchasers to add key dates to their calendar</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.calendar ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.calendar && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="flex flex-wrap gap-4 pt-3">
                      {[
                        { key: 'google', label: 'Google Calendar' },
                        { key: 'apple', label: 'Apple Calendar' },
                        { key: 'outlook', label: 'Outlook' },
                      ].map(cal => (
                        <label key={cal.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={config.calendarOptions[cal.key as keyof CalendarOptions]}
                            onChange={() => setConfig(prev => ({
                              ...prev,
                              calendarOptions: { ...prev.calendarOptions, [cal.key]: !prev.calendarOptions[cal.key as keyof CalendarOptions] }
                            }))}
                            className="w-4 h-4 rounded border-gray-300 text-[#D4AF37] focus:ring-[#D4AF37]"
                          />
                          <span className="text-sm text-gray-700">{cal.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* ── Journey Milestones Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, milestones: !prev.milestones }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <ListChecks className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Journey Milestones</p>
                      <p className="text-xs text-gray-500">Configure which milestones appear in the purchaser's timeline</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.milestones ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.milestones && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="space-y-2 pt-3">
                      {config.milestones.map((milestone) => (
                        <div key={milestone.id} className="flex flex-col">
                          <div className={`flex items-center gap-3 p-3 bg-white border border-gray-100 rounded-xl transition-all hover:border-gray-200 ${!milestone.enabled ? 'opacity-50' : ''}`}>
                            <div className="cursor-grab text-gray-400">
                              <GripIcon />
                            </div>
                            <span className="flex-1 text-sm font-medium text-gray-800">{milestone.label}</span>
                            <button
                              onClick={() => setExpandedMilestoneNotif(expandedMilestoneNotif === milestone.id ? null : milestone.id)}
                              className={`p-1.5 rounded-lg transition-colors ${expandedMilestoneNotif === milestone.id ? 'bg-amber-50 text-[#D4AF37]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                              title="Notification message"
                            >
                              <Bell className="w-3.5 h-3.5" />
                            </button>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={milestone.enabled}
                                onChange={() => toggleMilestone(milestone.id)}
                                className="sr-only"
                              />
                              <div
                                onClick={() => toggleMilestone(milestone.id)}
                                className={`relative w-11 h-6 rounded-full transition-all cursor-pointer ${milestone.enabled ? 'bg-[#D4AF37]' : 'bg-gray-200'}`}
                              >
                                <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${milestone.enabled ? 'translate-x-5' : ''}`} />
                              </div>
                            </label>
                          </div>
                          {expandedMilestoneNotif === milestone.id && (
                            <div className="mt-1 ml-8 p-3 bg-amber-50/50 border border-amber-100 rounded-xl">
                              <p className="text-xs font-medium text-gray-600 mb-1.5">Push notification when this milestone is reached</p>
                              <textarea
                                rows={2}
                                value={milestone.notificationMessage || ''}
                                onChange={(e) => setConfig(prev => ({
                                  ...prev,
                                  milestones: prev.milestones.map(ms => ms.id === milestone.id ? { ...ms, notificationMessage: e.target.value } : ms)
                                }))}
                                placeholder={`e.g. Great news! Your ${milestone.label} milestone has been reached.`}
                                className="w-full text-xs text-gray-800 border border-amber-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#D4AF37] resize-none bg-white"
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={addMilestone}
                      className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-[#D4AF37] transition-all"
                    >
                      <PlusIcon />
                      Add Custom Milestone
                    </button>
                  </div>
                )}
              </div>

              {/* ── FAQs Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, faqs: !prev.faqs }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Frequently Asked Questions</p>
                      <p className="text-xs text-gray-500">Common questions shown in the FAQ section</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.faqs ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.faqs && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="space-y-3 pt-3">
                      {config.faqs.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-4">No FAQs added yet. Click "Add FAQ" to create one.</p>
                      ) : (
                        config.faqs.map((faq, index) => (
                          <div key={faq.id} className="bg-white border border-gray-200 rounded-xl p-4 transition-all hover:border-gray-300 shadow-sm">
                            <div className="flex items-start justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700">Question {index + 1}</label>
                              <button onClick={() => removeFaq(faq.id)} className="p-1 rounded hover:bg-red-50 transition-all group">
                                <svg className="w-4 h-4 text-gray-400 group-hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            <input
                              type="text"
                              value={faq.question}
                              onChange={(e) => updateFaq(faq.id, 'question', e.target.value)}
                              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 mb-2 focus:outline-none focus:border-[#D4AF37]"
                              placeholder="Enter question..."
                            />
                            <textarea
                              value={faq.answer}
                              onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)}
                              rows={2}
                              className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 resize-y focus:outline-none focus:border-[#D4AF37]"
                              placeholder="Enter answer..."
                            />
                          </div>
                        ))
                      )}
                    </div>
                    <button
                      onClick={addFaq}
                      className="mt-3 flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-500 hover:text-[#D4AF37] transition-all"
                    >
                      <PlusIcon />
                      Add FAQ
                    </button>
                  </div>
                )}
              </div>

              {/* ── Contacts Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, contacts: !prev.contacts }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Phone className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Contact Information</p>
                      <p className="text-xs text-gray-500">Contact details shown to purchasers in the portal</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.contacts ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.contacts && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="grid grid-cols-2 gap-4 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales Phone Number</label>
                        <input
                          type="tel"
                          value={config.contacts.salesPhone}
                          onChange={(e) => setConfig(prev => ({ ...prev, contacts: { ...prev.contacts, salesPhone: e.target.value } }))}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37]"
                          placeholder="+353 21 456 7890"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales Email</label>
                        <input
                          type="email"
                          value={config.contacts.salesEmail}
                          onChange={(e) => setConfig(prev => ({ ...prev, contacts: { ...prev.contacts, salesEmail: e.target.value } }))}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37]"
                          placeholder="sales@development.ie"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Show House Address</label>
                        <input
                          type="text"
                          value={config.contacts.showHouseAddress}
                          onChange={(e) => setConfig(prev => ({ ...prev, contacts: { ...prev.contacts, showHouseAddress: e.target.value } }))}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37]"
                          placeholder="123 Main Street, Cork"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Status Messages Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, statusMessages: !prev.statusMessages }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <MessageSquare className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Status Messages</p>
                      <p className="text-xs text-gray-500">Custom messages for different build statuses</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.statusMessages ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.statusMessages && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="space-y-4 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            On Track Message
                          </span>
                        </label>
                        <input
                          type="text"
                          value={config.statusMessages.onTrack}
                          onChange={(e) => setConfig(prev => ({ ...prev, statusMessages: { ...prev.statusMessages, onTrack: e.target.value } }))}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          <span className="inline-flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            Delayed Message
                          </span>
                        </label>
                        <input
                          type="text"
                          value={config.statusMessages.delayed}
                          onChange={(e) => setConfig(prev => ({ ...prev, statusMessages: { ...prev.statusMessages, delayed: e.target.value } }))}
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Branding Section ── */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setSectionOpen(prev => ({ ...prev, branding: !prev.branding }))}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                      <Palette className="w-4 h-4 text-[#D4AF37]" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-semibold text-gray-900">Branding</p>
                      <p className="text-xs text-gray-500">Development name and accent colour for the portal</p>
                    </div>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${sectionOpen.branding ? 'rotate-180' : ''}`} />
                </button>
                {sectionOpen.branding && (
                  <div className="px-6 pb-5 pt-1 border-t border-gray-100">
                    <div className="space-y-4 pt-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Developer / Development Name</label>
                        <input
                          type="text"
                          value={config.branding.developerName}
                          onChange={(e) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, developerName: e.target.value } }))}
                          placeholder="e.g. Longview Park"
                          className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-[#D4AF37]"
                        />
                        <p className="text-xs text-gray-500 mt-1">Shown in the app header and welcome screen</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">Accent Colour</label>
                        <div className="flex items-center gap-3">
                          <input
                            type="color"
                            value={config.branding.accentColor}
                            onChange={(e) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, accentColor: e.target.value } }))}
                            className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                          />
                          <input
                            type="text"
                            value={config.branding.accentColor}
                            onChange={(e) => setConfig(prev => ({ ...prev, branding: { ...prev.branding, accentColor: e.target.value } }))}
                            className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-[#D4AF37]"
                          />
                          <span className="text-xs text-gray-500">Updates the preview live</span>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {['#D4AF37', '#1a1a2e', '#2d6a4f', '#0077b6', '#7b2d8b'].map(c => (
                            <button
                              key={c}
                              onClick={() => setConfig(prev => ({ ...prev, branding: { ...prev.branding, accentColor: c } }))}
                              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
                              style={{ backgroundColor: c, borderColor: config.branding.accentColor === c ? c : 'transparent' }}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            </div>

            {/* RIGHT COLUMN: Phone Preview */}
            <div className="col-span-1">
              <div className="sticky top-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Live Preview</h3>
                  <span className="text-xs text-gray-600">Tap to interact</span>
                </div>

                {/* Phone Device Frame */}
                <div className="w-[280px] h-[580px] bg-white rounded-[32px] border-[8px] border-gray-900 overflow-hidden relative shadow-xl">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[100px] h-[24px] bg-gray-900 rounded-b-xl z-10" />

                  {/* Backdrop */}
                  <div
                    className={`absolute inset-0 bg-black/30 z-[15] transition-opacity ${activeSheet ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={closeSheet}
                  />

                  <div className="h-full pt-8 flex flex-col overflow-hidden relative bg-gray-50">

                    {/* Phone Header */}
                    <div className="flex items-center justify-between px-4 py-2 bg-white border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: accent }}>
                          <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                          </svg>
                        </div>
                        <span className="text-[10px] font-semibold text-gray-900">
                          {config.branding.developerName || 'OpenHouse AI'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-medium text-gray-500 border border-gray-200 rounded px-1.5 py-0.5">EN</span>
                        <button className="w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-3 h-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Phone Main Content */}
                    <div className="flex-1 flex flex-col overflow-y-auto" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}>
                      <div className="px-4 pt-3 pb-2">
                        {/* Welcome Greeting */}
                        <p className="text-[10px] text-gray-500">{getTimeGreeting()}, <strong className="text-gray-900">Showhouse</strong> 👋</p>

                        {/* Property Card */}
                        <div className="mt-3 bg-white border border-gray-200 rounded-2xl p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${accent}20` }}>
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accent }}>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-[10px] font-semibold text-gray-900">14 Example Park</p>
                              <p className="text-[9px] text-gray-500">3 Bed · Type B</p>
                            </div>
                            {/* Status Badge */}
                            <div className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 bg-[#E8F5E9] border border-[#C8E6C9] rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#4CAF50]" />
                              <span className="text-[8px] font-medium text-[#2E7D32]">{config.statusMessages.onTrack}</span>
                            </div>
                          </div>

                          {/* Progress Section */}
                          <div className="mb-1">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[9px] text-gray-500">Progress</span>
                              <span className="text-[9px] font-semibold" style={{ color: accent }}>{progressPercent}%</span>
                            </div>
                            <div className="relative">
                              <div className="h-1 bg-gray-100 rounded-full" />
                              <div
                                className="absolute top-0 left-0 h-1 rounded-full transition-all duration-300"
                                style={{ width: `${progressPercent}%`, background: accent }}
                              />
                              <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-0">
                                {enabledMilestones.map((m, i) => (
                                  <div
                                    key={m.id}
                                    className="w-2 h-2 rounded-full border-2 bg-white"
                                    style={{
                                      borderColor: i <= currentMilestoneIndex ? accent : '#D1D5DB',
                                      background: i < currentMilestoneIndex ? accent : '#fff',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              <span className="text-[9px] text-gray-700 font-medium">
                                {enabledMilestones[currentMilestoneIndex]?.label || 'Closing'} · Est. {formatEstMonth(config.estHandover)}
                              </span>
                            </div>
                          </div>

                          {/* Action pills */}
                          <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                            <button onClick={() => openSheet('timeline')} className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accent }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              <span className="text-[9px] text-gray-700">Timeline</span>
                            </button>
                            <button onClick={() => openSheet('docs')} className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accent }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                              <span className="text-[9px] text-gray-700">Docs</span>
                            </button>
                            <button onClick={() => openSheet('calendar')} className="flex items-center gap-1 px-2 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors">
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: accent }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                              <span className="text-[9px] text-gray-700">Calendar</span>
                            </button>
                          </div>
                        </div>

                        {/* Quick Prompts Grid */}
                        <div className="grid grid-cols-2 gap-1.5 mt-3">
                          {[
                            'What bus goes to town?',
                            'When do I get my keys?',
                            "What's my BER rating?",
                            'Nearby schools',
                          ].map((q) => (
                            <button
                              key={q}
                              className="p-2 text-left rounded-xl border text-[9px] text-gray-700 hover:opacity-80 transition-colors leading-tight"
                              style={{ borderColor: `${accent}30`, background: `${accent}08` }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Input bar */}
                      <div className="mx-3 mb-2 mt-2 px-3 py-2 bg-gray-100 rounded-full flex items-center gap-2">
                        <span className="flex-1 text-[9px] text-gray-400">Ask about your home or community...</span>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: accent }}>
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-7V3" />
                          </svg>
                        </div>
                      </div>
                    </div>

                    {/* Phone Bottom Navigation */}
                    <div className="border-t border-gray-100 bg-white py-2 px-1">
                      <div className="flex items-center justify-around">
                        {[
                          { id: 'home', label: 'Assistant', icon: 'home' },
                          { id: 'maps', label: 'Maps', icon: 'map' },
                          { id: 'noticeboard', label: 'Noticeboard', icon: 'bell' },
                          { id: 'docs', label: 'Docs', icon: 'doc' },
                          { id: 'chat', label: 'Chat', icon: 'chat' },
                        ].map(nav => {
                          const isActive = activeNav === nav.id || (nav.id === 'home' && !activeSheet);
                          return (
                            <button
                              key={nav.id}
                              onClick={() => {
                                if (nav.id === 'home') closeSheet();
                                else if (nav.id === 'docs') openSheet('docs');
                                else if (nav.id === 'noticeboard') openSheet('faq');
                              }}
                              className="flex flex-col items-center gap-0.5 py-1 px-1.5"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: isActive ? accent : '#9CA3AF' }}>
                                {nav.icon === 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isActive ? 2 : 1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                                {nav.icon === 'map' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />}
                                {nav.icon === 'bell' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />}
                                {nav.icon === 'doc' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
                                {nav.icon === 'chat' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />}
                              </svg>
                              <span className="text-[8px]" style={{ color: isActive ? accent : '#9CA3AF', fontWeight: isActive ? 600 : 400 }}>{nav.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* ── Bottom Sheets ── */}

                    {/* Timeline Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'timeline' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">Your Timeline</h3>
                        <div className="space-y-2 max-h-[280px] overflow-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          {enabledMilestones.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: i <= currentMilestoneIndex ? accent : '#E5E7EB' }}>
                                {i <= currentMilestoneIndex ? (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <span className="text-[8px] text-gray-700">{i + 1}</span>
                                )}
                              </div>
                              <span className={`text-[10px] ${i <= currentMilestoneIndex ? 'font-medium text-gray-900' : 'text-gray-700'}`}>{m.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Docs Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'docs' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">Documents</h3>
                        <div className="space-y-2">
                          {[{ name: 'Floor Plans - Type B', size: '2.4 MB', color: 'bg-red-100 text-red-500' }, { name: 'Contract of Sale', size: '1.8 MB', color: 'bg-blue-100 text-blue-500' }, { name: 'Kitchen Selections', size: '856 KB', color: 'bg-emerald-100 text-emerald-500' }].map(doc => (
                            <div key={doc.name} className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${doc.color.split(' ')[0]}`}>
                                <svg className={`w-4 h-4 ${doc.color.split(' ')[1]}`} fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" /></svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-medium text-gray-900">{doc.name}</p>
                                <p className="text-[8px] text-gray-500">PDF · {doc.size}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <p className="text-[8px] text-gray-500 mt-3 text-center">Documents matched to your house type</p>
                      </div>
                    </div>

                    {/* FAQ Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'faq' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">FAQ</h3>
                        <div className="space-y-2 max-h-[280px] overflow-auto scrollbar-hide" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                          {config.faqs.length === 0 ? (
                            <p className="text-[10px] text-gray-500 text-center py-4">No FAQs configured</p>
                          ) : (
                            config.faqs.map((faq, i) => (
                              <div key={faq.id} className="p-2 bg-white border border-gray-100 rounded-lg">
                                <p className="text-[10px] font-medium text-gray-900">{faq.question || 'Question ' + (i + 1)}</p>
                                <p className="text-[8px] text-gray-500 mt-0.5">{faq.answer || 'Answer not set'}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Contact Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'contact' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">Contact Us</h3>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                            </div>
                            <div><p className="text-[10px] font-medium text-gray-900">Phone</p><p className="text-[8px] text-gray-500">{config.contacts.salesPhone || 'Not set'}</p></div>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <div><p className="text-[10px] font-medium text-gray-900">Email</p><p className="text-[8px] text-gray-500">{config.contacts.salesEmail || 'Not set'}</p></div>
                          </div>
                          {config.contacts.showHouseAddress && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              </div>
                              <div><p className="text-[10px] font-medium text-gray-900">Show House</p><p className="text-[8px] text-gray-500">{config.contacts.showHouseAddress}</p></div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Calendar Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'calendar' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">Add to Calendar</h3>
                        <div className="space-y-2">
                          {config.calendarOptions.google && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center"><span className="text-[10px] font-bold text-red-500">G</span></div>
                              <span className="text-[10px] font-medium text-gray-900">Google Calendar</span>
                            </div>
                          )}
                          {config.calendarOptions.apple && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83z" /></svg>
                              </div>
                              <span className="text-[10px] font-medium text-gray-900">Apple Calendar</span>
                            </div>
                          )}
                          {config.calendarOptions.outlook && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><span className="text-[10px] font-bold text-blue-500">O</span></div>
                              <span className="text-[10px] font-medium text-gray-900">Outlook</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Settings Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'settings' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">Settings</h3>
                        <div className="space-y-2">
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg></div>
                            <span className="text-[10px] font-medium text-gray-900">Notifications</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center"><svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" /></svg></div>
                            <span className="text-[10px] font-medium text-gray-900">Language</span>
                          </div>
                        </div>
                        <p className="text-[8px] text-gray-500 mt-4 text-center">OpenHouse v1.0.0</p>
                      </div>
                    </div>

                  </div>
                </div>

                <p className="text-xs text-gray-500 mt-4 text-center">Tap buttons to preview sheets. Data updates in real-time.</p>
              </div>
            </div>
          </div>

          {/* ── QR Code / Portal Access Section (full width below) ── */}
          <div className="mt-6 bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
                <QrCode className="w-4 h-4 text-[#D4AF37]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Portal Access</p>
                <p className="text-xs text-gray-500">QR code and preview link for homeowner welcome packs</p>
              </div>
            </div>
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                {qrCodeDataUrl ? (
                  <div className="w-28 h-28 rounded-xl overflow-hidden border border-gray-200">
                    <img src={qrCodeDataUrl} alt="Portal QR Code" className="w-full h-full" />
                  </div>
                ) : (
                  <button
                    onClick={generateQRCode}
                    className="w-28 h-28 rounded-xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center gap-2 hover:border-[#D4AF37] hover:bg-amber-50/30 transition-all"
                  >
                    <QrCode className="w-6 h-6 text-gray-400" />
                    <span className="text-[10px] text-gray-500 text-center">Generate QR</span>
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-3">
                <div>
                  <p className="text-xs font-medium text-gray-700 mb-1.5">Portal URL</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-100 rounded-lg px-3 py-2 text-gray-600 truncate">
                      {typeof window !== 'undefined' ? `${window.location.origin}/homes/...` : 'portal.openhouseai.ie/homes/...'}
                    </code>
                    <button
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          navigator.clipboard.writeText(`${window.location.origin}/homes/preview?dev=${developmentId}`).then(() => showToast('URL copied!'));
                        }
                      }}
                      className="px-3 py-2 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  {qrCodeDataUrl && (
                    <a
                      href={qrCodeDataUrl}
                      download="portal-qr-code.png"
                      className="px-4 py-2 text-xs font-medium text-white rounded-xl transition-all hover:opacity-90 flex items-center gap-1.5"
                      style={{ background: 'linear-gradient(135deg, #D4AF37 0%, #b8962e 100%)' }}
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PNG
                    </a>
                  )}
                  <button
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        const url = `${window.location.origin}/homes/preview?dev=${developmentId}`;
                        navigator.clipboard.writeText(url).then(() => showToast('Link copied!'));
                      }
                    }}
                    className="px-4 py-2 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-all flex items-center gap-1.5"
                  >
                    <Link className="w-3.5 h-3.5" />
                    Copy Link
                  </button>
                </div>
                {qrCodeDataUrl && (
                  <p className="text-xs text-gray-500">Print and include in welcome packs, signage, or email campaigns.</p>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
