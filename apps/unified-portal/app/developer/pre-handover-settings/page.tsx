'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';

interface Milestone {
  id: string;
  label: string;
  enabled: boolean;
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
};

const PlusIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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
        setConfig({ ...DEFAULT_CONFIG, ...data });
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
    <div className="min-h-screen bg-white font-sans">
      {/* Toast */}
      <div className={`fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-lg text-sm font-medium z-50 transition-all duration-300 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
        {toast.message}
      </div>

      <main className="px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pre-Handover Portal Settings</h1>
              <p className="text-gray-500 mt-1">Customise the experience purchasers see before their property is handed over.</p>
            </div>
            <div className="flex items-center gap-3">
              <button className="bg-white text-gray-700 px-5 py-2.5 rounded-lg font-medium text-sm border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all">
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
            <div className="col-span-2 space-y-6">
              {/* Welcome Message Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Welcome Message</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Personalised greeting shown to purchasers</p>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Greeting</label>
                    <input
                      type="text"
                      value={config.greeting}
                      onChange={(e) => setConfig(prev => ({ ...prev, greeting: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10 transition-all"
                      placeholder="e.g., Welcome to Rathard Park"
                    />
                    <p className="text-xs text-gray-400 mt-1.5">The purchaser's name is added automatically: "{config.greeting}, <strong>Sarah</strong>"</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Introduction Text</label>
                    <textarea
                      value={config.introText}
                      onChange={(e) => setConfig(prev => ({ ...prev, introText: e.target.value }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm resize-y min-h-[80px] focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10 transition-all"
                      placeholder="Optional welcome paragraph..."
                    />
                  </div>
                </div>
              </div>

              {/* Key Dates Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Key Dates</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Default estimated dates and calendar options</p>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Est. Handover Month</label>
                      <select
                        value={config.estHandover}
                        onChange={(e) => setConfig(prev => ({ ...prev, estHandover: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10 transition-all bg-white"
                      >
                        <option value="">Select month...</option>
                        {['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'].map(m => {
                          const [y, mo] = m.split('-');
                          const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
                          return <option key={m} value={m}>{months[parseInt(mo) - 1]} {y}</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Default Snagging Lead Time</label>
                      <select
                        value={config.snaggingLead}
                        onChange={(e) => setConfig(prev => ({ ...prev, snaggingLead: e.target.value }))}
                        className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37] focus:ring-2 focus:ring-[#D4AF37]/10 transition-all bg-white"
                      >
                        <option value="2">2 weeks before handover</option>
                        <option value="3">3 weeks before handover</option>
                        <option value="4">4 weeks before handover</option>
                      </select>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400">Shown in status badge. Override per unit in Sales Pipeline.</p>

                  <div className="pt-2 border-t border-gray-100">
                    <label className="block text-sm font-medium text-gray-700 mb-3">Calendar Integration</label>
                    <p className="text-xs text-gray-500 mb-3">Allow purchasers to add key dates to their calendar</p>
                    <div className="flex flex-wrap gap-4">
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
                </div>
              </div>

              {/* Milestones Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Journey Milestones</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Configure which milestones appear in the purchaser's timeline.</p>
                </div>
                <div className="space-y-2">
                  {config.milestones.map((milestone) => (
                    <div
                      key={milestone.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 border-gray-200 bg-white transition-all hover:border-gray-300 ${!milestone.enabled ? 'opacity-50' : ''}`}
                    >
                      <div className="cursor-grab">
                        <GripIcon />
                      </div>
                      <input
                        type="text"
                        value={milestone.label}
                        onChange={(e) => updateMilestoneLabel(milestone.id, e.target.value)}
                        className="flex-1 bg-white rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-[#D4AF37]"
                      />
                      <button
                        onClick={() => toggleMilestone(milestone.id)}
                        className={`relative w-11 h-6 rounded-full transition-all ${milestone.enabled ? 'bg-[#D4AF37]' : 'bg-gray-200'}`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${milestone.enabled ? 'translate-x-5' : ''}`} />
                      </button>
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

              {/* FAQs Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Frequently Asked Questions</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Common questions shown in the FAQ section</p>
                </div>
                <div className="space-y-3">
                  {config.faqs.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-4">No FAQs added yet. Click "Add FAQ" to create one.</p>
                  ) : (
                    config.faqs.map((faq, index) => (
                      <div key={faq.id} className="bg-white border border-gray-200 rounded-lg p-4 transition-all hover:border-gray-300 shadow-sm">
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
                          className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:border-[#D4AF37]"
                          placeholder="Enter question..."
                        />
                        <textarea
                          value={faq.answer}
                          onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)}
                          rows={2}
                          className="w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm resize-y focus:outline-none focus:border-[#D4AF37]"
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

              {/* Contact Information Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Contact Information</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Contact details shown to purchasers in the portal.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales Phone Number</label>
                    <input
                      type="tel"
                      value={config.contacts.salesPhone}
                      onChange={(e) => setConfig(prev => ({ ...prev, contacts: { ...prev.contacts, salesPhone: e.target.value } }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37]"
                      placeholder="+353 21 456 7890"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Sales Email</label>
                    <input
                      type="email"
                      value={config.contacts.salesEmail}
                      onChange={(e) => setConfig(prev => ({ ...prev, contacts: { ...prev.contacts, salesEmail: e.target.value } }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37]"
                      placeholder="sales@development.ie"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Show House Address</label>
                    <input
                      type="text"
                      value={config.contacts.showHouseAddress}
                      onChange={(e) => setConfig(prev => ({ ...prev, contacts: { ...prev.contacts, showHouseAddress: e.target.value } }))}
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37]"
                      placeholder="123 Main Street, Cork"
                    />
                  </div>
                </div>
              </div>

              {/* Status Messages Section */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="mb-4">
                  <h3 className="font-semibold text-gray-900">Status Messages</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Custom messages for different statuses</p>
                </div>
                <div className="space-y-4">
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
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37]"
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
                      className="w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#D4AF37]"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Phone Preview */}
            <div className="col-span-1">
              <div className="sticky top-8">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900">Live Preview</h3>
                  <span className="text-xs text-gray-400">Tap to interact</span>
                </div>

                {/* Phone Device Frame */}
                <div className="w-[280px] h-[580px] bg-white rounded-[32px] border-[8px] border-gray-900 overflow-hidden relative">
                  {/* Notch */}
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[120px] h-[28px] bg-gray-900 rounded-b-2xl z-10" />

                  {/* Backdrop */}
                  <div 
                    className={`absolute inset-0 bg-black/30 z-[15] transition-opacity ${activeSheet ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                    onClick={closeSheet}
                  />

                  <div className="h-full pt-10 pb-4 px-4 flex flex-col overflow-hidden relative">
                    {/* Phone Header */}
                    <div className="flex items-center justify-between py-3">
                      <div>
                        <p className="text-[10px] text-gray-500">{getTimeGreeting()}</p>
                        <p className="text-sm font-semibold text-gray-900">My Home</p>
                      </div>
                      <button 
                        onClick={() => openSheet('settings')}
                        className="w-7 h-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform shadow-sm"
                      >
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </button>
                    </div>

                    {/* Phone Main Content */}
                    <div className="flex-1 flex flex-col items-center pt-2 overflow-auto">
                      {/* Welcome Greeting */}
                      <p className="text-[10px] text-gray-600 mb-2 text-center px-2">
                        {config.greeting}, <strong>Sarah</strong>
                      </p>

                      {/* Property Card */}
                      <div className="bg-white rounded-2xl p-4 w-full text-center shadow-sm border border-gray-100">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-[#D4AF37]/20 to-[#D4AF37]/5 flex items-center justify-center border border-[#D4AF37]/20">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#D4AF37] to-amber-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 3L4 9v12h5v-7h6v7h5V9l-8-6z"/>
                            </svg>
                          </div>
                        </div>
                        <p className="font-serif text-base text-gray-900">14 Example Park</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">3 Bed Semi-Detached · Type B</p>
                        
                        <div className="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-100 rounded-full">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span className="text-[10px] font-medium text-emerald-700">
                            {config.statusMessages.onTrack} · Est. {formatEstMonth(config.estHandover)}
                          </span>
                        </div>

                        <div className="my-3 h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                        <div className="text-left">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[9px] font-medium text-gray-400 uppercase tracking-wider">Progress</span>
                            <span className="text-[10px] font-semibold text-[#D4AF37]">{progressPercent}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-200 overflow-hidden">
                            <div 
                              className="h-full rounded-full bg-gradient-to-r from-[#D4AF37] to-amber-400 transition-all duration-300"
                              style={{ width: `${progressPercent}%` }}
                            />
                          </div>
                          <div className="mt-2 flex items-center justify-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] animate-pulse" />
                            <span className="text-[10px] text-gray-600">
                              <span className="font-medium">{enabledMilestones[currentMilestoneIndex]?.label || 'Snagging'}</span>
                              <span className="text-gray-400"> · Est. 28 Jan</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action Buttons Grid */}
                      <div className="grid grid-cols-4 gap-1.5 mt-3 w-full">
                        <button onClick={() => openSheet('timeline')} className="bg-white rounded-xl p-2 text-center border border-gray-100 hover:scale-105 active:scale-95 transition-transform shadow-sm">
                          <div className="w-6 h-6 mx-auto rounded-lg bg-violet-50 flex items-center justify-center mb-1">
                            <svg className="w-3 h-3 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <span className="text-[8px] text-gray-600">Timeline</span>
                        </button>
                        <button onClick={() => openSheet('docs')} className="bg-white rounded-xl p-2 text-center border border-gray-100 hover:scale-105 active:scale-95 transition-transform shadow-sm">
                          <div className="w-6 h-6 mx-auto rounded-lg bg-blue-50 flex items-center justify-center mb-1">
                            <svg className="w-3 h-3 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                          </div>
                          <span className="text-[8px] text-gray-600">Docs</span>
                        </button>
                        <button onClick={() => openSheet('faq')} className="bg-white rounded-xl p-2 text-center border border-gray-100 hover:scale-105 active:scale-95 transition-transform shadow-sm">
                          <div className="w-6 h-6 mx-auto rounded-lg bg-amber-50 flex items-center justify-center mb-1">
                            <svg className="w-3 h-3 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          </div>
                          <span className="text-[8px] text-gray-600">FAQ</span>
                        </button>
                        <button onClick={() => openSheet('contact')} className="bg-white rounded-xl p-2 text-center border border-gray-100 hover:scale-105 active:scale-95 transition-transform shadow-sm">
                          <div className="w-6 h-6 mx-auto rounded-lg bg-emerald-50 flex items-center justify-center mb-1">
                            <svg className="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                          </div>
                          <span className="text-[8px] text-gray-600">Contact</span>
                        </button>
                      </div>

                      {/* Key Dates Card */}
                      <button
                        onClick={() => openSheet('calendar')}
                        className="w-full mt-3 bg-white rounded-xl p-3 border border-gray-100 shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-transform text-left"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg bg-rose-50 flex items-center justify-center">
                              <svg className="w-3 h-3 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div>
                              <p className="text-[10px] font-medium text-gray-900">Key Dates</p>
                              <p className="text-[8px] text-gray-500">Snagging, Handover</p>
                            </div>
                          </div>
                          <span className="text-[8px] text-[#D4AF37] font-medium">Add to Calendar →</span>
                        </div>
                      </button>
                    </div>

                    {/* Phone Bottom Navigation */}
                    <div className="mt-auto pt-2 border-t border-gray-200/50 relative z-10 bg-gradient-to-t from-white to-transparent">
                      <div className="flex items-center justify-around">
                        {[
                          { id: 'home', icon: 'home', label: 'Home' },
                          { id: 'docs', icon: 'doc', label: 'Docs' },
                          { id: 'faq', icon: 'question', label: 'FAQ' },
                        ].map(nav => (
                          <button
                            key={nav.id}
                            onClick={() => {
                              if (nav.id === 'home') closeSheet();
                              else openSheet(nav.id);
                            }}
                            className="text-center"
                          >
                            <svg className={`w-5 h-5 mx-auto ${activeNav === nav.id ? 'text-[#D4AF37]' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              {nav.icon === 'home' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />}
                              {nav.icon === 'doc' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />}
                              {nav.icon === 'question' && <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />}
                            </svg>
                            <span className={`text-[8px] ${activeNav === nav.id ? 'text-[#D4AF37] font-semibold' : 'text-gray-400'}`}>{nav.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Bottom Sheets */}
                    {/* Timeline Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'timeline' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">Your Timeline</h3>
                        <div className="space-y-2 max-h-[280px] overflow-auto">
                          {enabledMilestones.map((m, i) => (
                            <div key={m.id} className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${i <= currentMilestoneIndex ? 'bg-[#D4AF37]' : 'bg-gray-200'}`}>
                                {i <= currentMilestoneIndex ? (
                                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                ) : (
                                  <span className="text-[8px] text-gray-500">{i + 1}</span>
                                )}
                              </div>
                              <span className={`text-[10px] ${i <= currentMilestoneIndex ? 'font-medium text-gray-900' : 'text-gray-500'}`}>{m.label}</span>
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
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-gray-900">Floor Plans - Type B</p>
                              <p className="text-[8px] text-gray-500">PDF · 2.4 MB</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-gray-900">Contract of Sale</p>
                              <p className="text-[8px] text-gray-500">PDF · 1.8 MB</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/></svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-gray-900">Kitchen Selections</p>
                              <p className="text-[8px] text-gray-500">PDF · 856 KB</p>
                            </div>
                          </div>
                        </div>
                        <p className="text-[8px] text-gray-400 mt-3 text-center">Documents matched to your house type</p>
                      </div>
                    </div>

                    {/* FAQ Sheet */}
                    <div className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.15)] z-20 max-h-[75%] transition-transform duration-300 ${activeSheet === 'faq' ? 'translate-y-0' : 'translate-y-full'}`}>
                      <div className="p-4">
                        <div className="w-8 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
                        <h3 className="font-semibold text-sm text-gray-900 mb-3">FAQ</h3>
                        <div className="space-y-2 max-h-[280px] overflow-auto">
                          {config.faqs.length === 0 ? (
                            <p className="text-[10px] text-gray-400 text-center py-4">No FAQs configured</p>
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
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-gray-900">Phone</p>
                              <p className="text-[8px] text-gray-500">{config.contacts.salesPhone || 'Not set'}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            </div>
                            <div className="flex-1">
                              <p className="text-[10px] font-medium text-gray-900">Email</p>
                              <p className="text-[8px] text-gray-500">{config.contacts.salesEmail || 'Not set'}</p>
                            </div>
                          </div>
                          {config.contacts.showHouseAddress && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              </div>
                              <div className="flex-1">
                                <p className="text-[10px] font-medium text-gray-900">Show House</p>
                                <p className="text-[8px] text-gray-500">{config.contacts.showHouseAddress}</p>
                              </div>
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
                              <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-red-500">G</span>
                              </div>
                              <span className="text-[10px] font-medium text-gray-900">Google Calendar</span>
                            </div>
                          )}
                          {config.calendarOptions.apple && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                                <svg className="w-4 h-4 text-gray-600" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83z"/></svg>
                              </div>
                              <span className="text-[10px] font-medium text-gray-900">Apple Calendar</span>
                            </div>
                          )}
                          {config.calendarOptions.outlook && (
                            <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                              <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-blue-500">O</span>
                              </div>
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
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
                            </div>
                            <span className="text-[10px] font-medium text-gray-900">Notifications</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-violet-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10" /></svg>
                            </div>
                            <span className="text-[10px] font-medium text-gray-900">Language</span>
                          </div>
                          <div className="flex items-center gap-3 p-2 bg-white border border-gray-100 rounded-lg">
                            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center">
                              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </div>
                            <span className="text-[10px] font-medium text-gray-900">Help & Support</span>
                          </div>
                        </div>
                        <p className="text-[8px] text-gray-400 mt-4 text-center">OpenHouse v1.0.0</p>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-400 mt-4 text-center">Tap buttons to preview sheets. Data updates in real-time.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
