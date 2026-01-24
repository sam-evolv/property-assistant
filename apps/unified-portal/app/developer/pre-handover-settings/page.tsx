'use client';

import { useState, useEffect, useCallback } from 'react';
import { useCurrentContext } from '@/contexts/CurrentContext';
import { UnitHandoverStatus } from '@/components/developer/UnitHandoverStatus';

// =============================================================================
// Types
// =============================================================================

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

interface DocumentSettings {
  showFloorPlans: boolean;
  showContract: boolean;
  showKitchenSelections: boolean;
}

interface PreHandoverConfig {
  milestones: Milestone[];
  faqs: FAQ[];
  contacts: ContactInfo;
  documents: DocumentSettings;
}

// =============================================================================
// Design Tokens
// =============================================================================

const tokens = {
  gold: '#D4A853',
  goldLight: '#e8c878',
  goldDark: '#b8923f',
  dark: '#1a1a1a',
  darker: '#0f0f0f',
  cream: '#fafaf8',
  warmGray: '#f7f6f3',
  textPrimary: '#1a1a1a',
  textSecondary: '#6b7280',
  textMuted: '#9ca3af',
  success: '#22c55e',
  warning: '#f97316',
  danger: '#ef4444',
};

// =============================================================================
// Icons
// =============================================================================

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

const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// =============================================================================
// Default Config
// =============================================================================

const DEFAULT_CONFIG: PreHandoverConfig = {
  milestones: [
    { id: 'sale_agreed', label: 'Sale Agreed', enabled: true },
    { id: 'contracts_signed', label: 'Contracts Signed', enabled: true },
    { id: 'kitchen_selection', label: 'Kitchen Selection', enabled: true },
    { id: 'snagging', label: 'Snagging', enabled: true },
    { id: 'closing', label: 'Closing', enabled: true },
    { id: 'handover', label: 'Handover', enabled: true },
  ],
  faqs: [],
  contacts: {
    salesPhone: '',
    salesEmail: '',
    showHouseAddress: '',
  },
  documents: {
    showFloorPlans: true,
    showContract: true,
    showKitchenSelections: true,
  },
};

// =============================================================================
// Main Component
// =============================================================================

export default function PreHandoverSettingsPage() {
  const { developmentId } = useCurrentContext();
  const [config, setConfig] = useState<PreHandoverConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Fetch config on mount
  useEffect(() => {
    if (developmentId) {
      fetchConfig();
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
    setSaveStatus('idle');
    try {
      const response = await fetch(`/api/developments/${developmentId}/prehandover-config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  // Milestone handlers
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

  const addCustomMilestone = () => {
    const newId = `custom_${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      milestones: [...prev.milestones, { id: newId, label: 'New Milestone', enabled: true }],
    }));
  };

  // FAQ handlers
  const addFaq = () => {
    const newId = `faq_${Date.now()}`;
    setConfig(prev => ({
      ...prev,
      faqs: [...prev.faqs, { id: newId, question: '', answer: '' }],
    }));
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
  };

  // Contact handlers
  const updateContact = (field: keyof ContactInfo, value: string) => {
    setConfig(prev => ({
      ...prev,
      contacts: { ...prev.contacts, [field]: value },
    }));
  };

  // Document handlers
  const toggleDocument = (field: keyof DocumentSettings) => {
    setConfig(prev => ({
      ...prev,
      documents: { ...prev.documents, [field]: !prev.documents[field] },
    }));
  };

  if (!developmentId) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <p className="text-gray-500">Please select a development first</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: tokens.cream }}>
        <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: tokens.gold, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8" style={{ backgroundColor: tokens.cream, fontFamily: "'DM Sans', sans-serif" }}>
      <style jsx global>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap');`}</style>

      {/* Header */}
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-2xl font-bold" style={{ color: tokens.dark }}>Pre-Handover Portal Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Customize the experience purchasers see before their property is handed over.
        </p>
      </div>

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Milestones Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.dark }}>Journey Milestones</h2>
          <p className="text-sm text-gray-500 mb-6">Configure which milestones appear in the purchaser's timeline.</p>

          <div className="space-y-3">
            {config.milestones.map((milestone) => (
              <div
                key={milestone.id}
                className="flex items-center gap-4 p-4 rounded-xl"
                style={{ backgroundColor: tokens.warmGray }}
              >
                <GripIcon />
                <input
                  type="text"
                  value={milestone.label}
                  onChange={(e) => updateMilestoneLabel(milestone.id, e.target.value)}
                  className="flex-1 bg-white rounded-lg px-3 py-2 text-sm border border-gray-200 focus:outline-none focus:border-amber-400"
                  style={{ color: tokens.dark }}
                />
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={milestone.enabled}
                    onChange={() => toggleMilestone(milestone.id)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" style={{ backgroundColor: milestone.enabled ? tokens.gold : '#d1d5db' }} />
                </label>
              </div>
            ))}
          </div>

          <button
            onClick={addCustomMilestone}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
            style={{ color: tokens.textSecondary }}
          >
            <PlusIcon />
            Add Custom Milestone
          </button>
        </div>

        {/* Contact Information Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.dark }}>Contact Information</h2>
          <p className="text-sm text-gray-500 mb-6">Contact details shown to purchasers in the portal.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.dark }}>Sales Phone Number</label>
              <input
                type="tel"
                value={config.contacts.salesPhone}
                onChange={(e) => updateContact('salesPhone', e.target.value)}
                placeholder="+353 21 456 7890"
                className="w-full bg-white rounded-lg px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:border-amber-400"
                style={{ color: tokens.dark }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.dark }}>Sales Email</label>
              <input
                type="email"
                value={config.contacts.salesEmail}
                onChange={(e) => updateContact('salesEmail', e.target.value)}
                placeholder="sales@development.ie"
                className="w-full bg-white rounded-lg px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:border-amber-400"
                style={{ color: tokens.dark }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: tokens.dark }}>Show House Address</label>
              <input
                type="text"
                value={config.contacts.showHouseAddress}
                onChange={(e) => updateContact('showHouseAddress', e.target.value)}
                placeholder="123 Main Street, Cork"
                className="w-full bg-white rounded-lg px-4 py-3 text-sm border border-gray-200 focus:outline-none focus:border-amber-400"
                style={{ color: tokens.dark }}
              />
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.dark }}>Frequently Asked Questions</h2>
          <p className="text-sm text-gray-500 mb-6">Add custom FAQs for your development. These appear in the FAQ section.</p>

          <div className="space-y-4">
            {config.faqs.map((faq, index) => (
              <div key={faq.id} className="p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-start mb-3">
                  <label className="text-sm font-medium" style={{ color: tokens.dark }}>Question {index + 1}</label>
                  <button
                    onClick={() => removeFaq(faq.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-all"
                  >
                    <TrashIcon />
                  </button>
                </div>
                <input
                  type="text"
                  value={faq.question}
                  onChange={(e) => updateFaq(faq.id, 'question', e.target.value)}
                  placeholder="e.g., When will I get my keys?"
                  className="w-full bg-white rounded-lg px-4 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-amber-400 mb-3"
                  style={{ color: tokens.dark }}
                />
                <textarea
                  value={faq.answer}
                  onChange={(e) => updateFaq(faq.id, 'answer', e.target.value)}
                  placeholder="Your answer here..."
                  rows={3}
                  className="w-full bg-white rounded-lg px-4 py-2.5 text-sm border border-gray-200 focus:outline-none focus:border-amber-400 resize-none"
                  style={{ color: tokens.dark }}
                />
              </div>
            ))}
          </div>

          <button
            onClick={addFaq}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:border-gray-300 transition-all"
            style={{ color: tokens.textSecondary }}
          >
            <PlusIcon />
            Add FAQ
          </button>
        </div>

        {/* Documents Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.dark }}>Documents</h2>
          <p className="text-sm text-gray-500 mb-6">Control which document types are visible to purchasers.</p>

          <div className="space-y-4">
            {[
              { key: 'showFloorPlans', label: 'Floor Plans', description: 'Show floor plan documents' },
              { key: 'showContract', label: 'Contract of Sale', description: 'Show contract documents' },
              { key: 'showKitchenSelections', label: 'Kitchen Selections', description: 'Show kitchen selection documents' },
            ].map((item) => (
              <div key={item.key} className="flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: tokens.warmGray }}>
                <div>
                  <p className="text-sm font-medium" style={{ color: tokens.dark }}>{item.label}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.documents[item.key as keyof DocumentSettings]}
                    onChange={() => toggleDocument(item.key as keyof DocumentSettings)}
                    className="sr-only peer"
                  />
                  <div
                    className="w-11 h-6 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all"
                    style={{ backgroundColor: config.documents[item.key as keyof DocumentSettings] ? tokens.gold : '#d1d5db' }}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          {saveStatus === 'success' && (
            <span className="flex items-center gap-2 text-sm font-medium" style={{ color: tokens.success }}>
              <SaveIcon /> Settings saved successfully
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-sm font-medium" style={{ color: tokens.danger }}>
              Failed to save settings
            </span>
          )}
          <button
            onClick={saveConfig}
            disabled={isSaving}
            className="px-6 py-3 text-sm font-semibold rounded-xl transition-all hover:shadow-md disabled:opacity-50"
            style={{ backgroundColor: tokens.gold, color: tokens.dark }}
          >
            {isSaving ? 'Saving...' : 'Save Pre-Handover Settings'}
          </button>
        </div>

        {/* Unit Handover Status Section */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <h2 className="text-lg font-semibold mb-1" style={{ color: tokens.dark }}>Unit Handover Status</h2>
          <p className="text-sm text-gray-500 mb-6">
            Manage milestone progress and handover status for individual units.
          </p>
          <UnitHandoverStatus developmentId={developmentId} />
        </div>
      </div>
    </div>
  );
}
